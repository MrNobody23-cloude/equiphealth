// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDrejX0h-iiyzQrWJUs0mWjhwKfS7eym3Q",
  authDomain: "equiphealth23.firebaseapp.com",
  projectId: "equiphealth23",
  storageBucket: "equiphealth23.firebasestorage.app",
  messagingSenderId: "552665705103",
  appId: "1:552665705103:web:62b5ceb3d611696d80defa",
  measurementId: "G-QVFR7P3T53"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);