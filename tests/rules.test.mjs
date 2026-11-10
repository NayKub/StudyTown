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

test('codes and emails: exact get only, no listing, no hijacking', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'codes/ABC234'), { uid: 'alice', name: 'Alice' }));
  await assertFails(setDoc(doc(as('bob'), 'codes/ABC234'), { uid: 'bob', name: 'Bob' }));
  await assertSucceeds(getDoc(doc(as('bob'), 'codes/ABC234')));
  await assertFails(getDocs(collection(as('bob'), 'codes')));
  await assertSucceeds(setDoc(doc(as('alice', 'alice@test.com'), 'emails/alice@test.com'), { uid: 'alice', name: 'Alice' }));
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
  const db = as('bob'); const b = writeBatch(db);
  b.set(doc(db, 'friends/bob/list/alice'), { name: 'Alice' });
  b.set(doc(db, 'friends/alice/list/bob'), { name: 'Bob' });
  b.delete(doc(db, 'requests/alice_bob'));
  await assertSucceeds(b.commit());
  await assertFails(getDocs(collection(as('carol'), 'friends/alice/list')));
  await assertSucceeds(deleteDoc(doc(as('alice'), 'friends/bob/list/alice')));
});
