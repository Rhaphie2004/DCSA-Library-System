# Gates: DCSA standalone library build

OWNS: app/**, HTML/**, CSS/**, JS/**, scripts/**, tests/**, package.json, package-lock.json, .gitignore, README.md, plan.md, GATES.md

Scope: offline desktop library with persistent inventory, protected circulation, reports, and recoverable backups.

- [x] G1: Database, permissions, circulation and recovery behave correctly on real SQLite fixtures
      CHECK: npm test
      EXPECT: fail 0
      EVIDENCE: automatic-evidence=v1; definition-sha256=29459e73eeecdf01d1217661a57d6bf4eca08c68489167b4db5a5ce0576dd123; exit=0; EXPECT=matched; output-sha256=4352b0698b583bf5191b2887b3d5a8de449c1a0dcdb7acc3e5aed233e2074b15; output-bytes=2106; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\DCSA-Library-System; path=fcb812c55905/36 entries

- [x] G2: Electron can complete setup, borrow and return through the actual UI and persist data across restart
      CHECK: npm run test:desktop
      EXPECT: DESKTOP CHECK PASSED
      EVIDENCE: automatic-evidence=v1; definition-sha256=3ee34ac4fb351b5bd1c0a6775acedff73ccdb5b29639ef59129951eb47cdab97; exit=0; EXPECT=matched; output-sha256=378eb0d90329ca6b0b191f22bd784fa25078f8c5659ddb5cf28fc2493b6dfd12; output-bytes=207; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\DCSA-Library-System; path=fcb812c55905/36 entries

- [x] G3: Offline Windows installer is produced
      CHECK: node scripts/build-check.js
      EXPECT: INSTALLER CHECK PASSED
      EVIDENCE: automatic-evidence=v1; definition-sha256=a500c92551797c3204678fdff4fea48f75f879f95f2854d8b4cfbac2f0c865c0; exit=0; EXPECT=matched; output-sha256=e4fd8d15e1b90f5d9ff6e2d358543f5f426d266b89dd2bf7c00474bab4d49365; output-bytes=1728; shell=C:\WINDOWS\system32\cmd.exe; cwd=D:\DCSA-Library-System; path=fcb812c55905/36 entries

- [ ] G4: Target hardware, real library policies, and official inventory are accepted by the librarian before live use
      EVIDENCE: pending user/librarian validation; implementation must not claim operational cutover.
