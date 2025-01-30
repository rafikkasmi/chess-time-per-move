import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
const firebaseConfig = {
  apiKey: "AIzaSyDNpvdlGj08OTZvNEb4n_78djTcGkZf4HA",
  authDomain: "junction-cc5ca.firebaseapp.com",
  projectId: "junction-cc5ca",
  storageBucket: "junction-cc5ca.appspot.com",
  messagingSenderId: "829463991201",
  appId: "1:829463991201:web:569fff154cf307954771e0",
  measurementId: "G-QWF90RKBF2",
};
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const auth = getAuth(app);
export { firestore, auth }