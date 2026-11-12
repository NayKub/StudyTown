// Security rules tests. Run with: npm run test:rules (starts the Firestore emulator, needs Java 21).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-studytown',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const as = (uid, email) => env.authenticatedContext(uid, { email: email || `${uid}@test.com` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
const req = (from, to) => ({ from, to, fromName: from, fromCode: 'AAAAAA', toName: to, toCode: '' });

test('profiles: owner writes, strangers cannot read, friends can', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'), { name: 'Alice', code: 'AAAAAA', totalMin: 10 }));
  await assertFails(setDoc(doc(as('bob'), 'profiles/alice'), { name: 'X', code: 'X', totalMin: 1 }));
  await assertFails(getDoc(doc(as('bob'), 'profiles/alice')));
  await assertFails(getDoc(doc(anon(), 'profiles/alice')));
  await seed((db) => setDoc(doc(db, 'friends/alice/list/bob'), { name: 'Bob' }));
  await assertSucceeds(getDoc(doc(as('bob'), 'profiles/alice')));
});

test('profile pictures: small JPEG photos and short avatar ids only', async () => {
  const base = { name: 'Alice', code: 'AAAAAA', totalMin: 0 };
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'), { ...base, avatar: 'cat', photo }));
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'), { ...base, avatar: '', photo: '' }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'), { ...base, photo: 'javascript:alert(1)' }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'), { ...base, photo: 'data:image/svg+xml;base64,AAAA' }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'), { ...base, photo: photo + 'A'.repeat(40000) }));
  await assertFails(setDoc(doc(as('alice'), 'profiles/alice'), { ...base, avatar: 'x'.repeat(50) }));
});

test('attacks: friends only, once a day, not on peaceful players, read and cleared by the target', async () => {
  const day = Math.floor(Date.now() / 86400000);
  const bomb = (from, to, extra = {}) => ({ from, to, item: 'big', fromName: from, fromAvatar: '', day, ...extra });
  const id = (from, to, d = day) => `attacks/${from}_${to}_${d}`;
  // strangers can't attack
  await assertFails(setDoc(doc(as('alice'), id('alice', 'bob')), bomb('alice', 'bob')));
  await seed(async (db) => {
    await setDoc(doc(db, 'friends/alice/list/bob'), { name: 'Bob' });
    await setDoc(doc(db, 'friends/bob/list/alice'), { name: 'Alice' });
    await setDoc(doc(db, 'friends/alice/list/carol'), { name: 'Carol' });
    await setDoc(doc(db, 'friends/carol/list/alice'), { name: 'Alice' });
    await setDoc(doc(db, 'profiles/carol'), { name: 'Carol', code: 'CCCCCC', totalMin: 0, peaceful: true });
  });
  // wrong sender, wrong item, wrong day, id that doesn't match
  await assertFails(setDoc(doc(as('alice'), id('bob', 'alice')), bomb('bob', 'alice')));
  await assertFails(setDoc(doc(as('alice'), id('alice', 'bob')), bomb('alice', 'bob', { item: 'nuke' })));
  await assertFails(setDoc(doc(as('alice'), id('alice', 'bob', day - 3)), bomb('alice', 'bob', { day: day - 3 })));
  await assertFails(setDoc(doc(as('alice'), 'attacks/whatever'), bomb('alice', 'bob')));
  // a friend can, once a day
  await assertSucceeds(setDoc(doc(as('alice'), id('alice', 'bob')), bomb('alice', 'bob')));
  await assertFails(setDoc(doc(as('alice'), id('alice', 'bob')), bomb('alice', 'bob', { item: 'mini' })));
  // peaceful players can't be attacked
  await assertFails(setDoc(doc(as('alice'), id('alice', 'carol')), bomb('alice', 'carol')));
  // the target sees it and clears it; others can't list it
  await assertSucceeds(getDocs(query(collection(as('bob'), 'attacks'), where('to', '==', 'bob'))));
  await assertFails(getDocs(query(collection(as('carol'), 'attacks'), where('to', '==', 'bob'))));
  await assertFails(deleteDoc(doc(as('carol'), id('alice', 'bob'))));
  await assertSucceeds(deleteDoc(doc(as('bob'), id('alice', 'bob'))));
});

test('codes and emails: exact get only, no listing, no hijacking', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'codes/ABC234'), { uid: 'alice', name: 'Alice' }));
  await assertFails(setDoc(doc(as('bob'), 'codes/ABC234'), { uid: 'bob', name: 'Bob' }));
  await assertSucceeds(getDoc(doc(as('bob'), 'codes/ABC234')));
  await assertFails(getDocs(collection(as('bob'), 'codes')));
  await assertSucceeds(
    setDoc(doc(as('alice', 'alice@test.com'), 'emails/alice@test.com'), { uid: 'alice', name: 'Alice' }),
  );
  await assertFails(setDoc(doc(as('bob', 'bob@test.com'), 'emails/carol@test.com'), { uid: 'bob', name: 'Bob' }));
  await assertFails(getDocs(collection(as('bob'), 'emails')));
});

test('backups are private', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'backups/alice'), { state: '{}' }));
  await assertFails(getDoc(doc(as('bob'), 'backups/alice')));
  await assertFails(setDoc(doc(as('bob'), 'backups/alice'), { state: '{}' }));
});

test('requests: only as yourself, visible to both sides only', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'requests/alice_bob'), req('alice', 'bob')));
  await assertFails(setDoc(doc(as('carol'), 'requests/alice_bob'), req('alice', 'bob')));
  await assertFails(setDoc(doc(as('alice'), 'requests/alice_alice'), req('alice', 'alice')));
  await assertSucceeds(getDocs(query(collection(as('bob'), 'requests'), where('to', '==', 'bob'))));
  await assertFails(getDoc(doc(as('carol'), 'requests/alice_bob')));
  // looking up or deleting a request that does not exist must not error
  await assertSucceeds(getDoc(doc(as('bob'), 'requests/bob_alice')));
  await assertSucceeds(deleteDoc(doc(as('bob'), 'requests/bob_alice')));
});

test('own profile, backup and friend list are readable by the owner', async () => {
  await assertSucceeds(getDoc(doc(as('alice'), 'profiles/alice')));
  await assertSucceeds(getDoc(doc(as('alice'), 'backups/alice')));
  await assertSucceeds(getDocs(collection(as('alice'), 'friends/alice/list')));
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'), { name: 'Alice', code: 'AAAAAA', totalMin: 0 }));
  await assertSucceeds(setDoc(doc(as('alice'), 'profiles/alice'), { totalMin: 5, streak: 1 }, { merge: true }));
  await assertSucceeds(setDoc(doc(as('alice'), 'backups/alice'), { state: '{"totalSec":60}' }));
  await assertSucceeds(getDoc(doc(as('alice'), 'backups/alice')));
  await assertSucceeds(deleteDoc(doc(as('alice'), 'backups/alice')));
  await assertSucceeds(deleteDoc(doc(as('alice'), 'emails/nobody@test.com')));
});

test('friendship only by accepting a request, either side can end it', async () => {
  // no request: cannot add yourself to someone's list
  await assertFails(setDoc(doc(as('bob'), 'friends/alice/list/bob'), { name: 'Bob' }));
  await seed((db) => setDoc(doc(db, 'requests/alice_bob'), req('alice', 'bob')));
  // the sender cannot accept their own request
  await assertFails(setDoc(doc(as('alice'), 'friends/bob/list/alice'), { name: 'Alice' }));
  // the receiver accepts in one batch
  const db = as('bob');
  const b = writeBatch(db);
  b.set(doc(db, 'friends/bob/list/alice'), { name: 'Alice' });
  b.set(doc(db, 'friends/alice/list/bob'), { name: 'Bob' });
  b.delete(doc(db, 'requests/alice_bob'));
  await assertSucceeds(b.commit());
  await assertFails(getDocs(collection(as('carol'), 'friends/alice/list')));
  await assertSucceeds(deleteDoc(doc(as('alice'), 'friends/bob/list/alice')));
});
