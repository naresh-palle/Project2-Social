import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBKVMtMItwaYFH_iMWgkRLfZq1N5qtwxKw",
  authDomain: "cr8studio-b91fe.firebaseapp.com",
  projectId: "cr8studio-b91fe",
  storageBucket: "cr8studio-b91fe.firebasestorage.app",
  messagingSenderId: "691128105813",
  appId: "1:691128105813:web:d1f29c7f32e5ba11294ddc",
  measurementId: "G-QMFHTJKMX4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
