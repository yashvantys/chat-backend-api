import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";

import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID;

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]!
    : initializeApp({
        projectId,
        ...(process.env.FIRESTORE_EMULATOR_HOST
          ? {}
          : {
              credential: applicationDefault(),
            }),
      });

export const firestore = getFirestore(firebaseApp);
