"use strict";

const { randomUUID } = require("crypto");

// Imported from the owner-provided onsite list. Source-system passwords and
// course/cohort fields are deliberately excluded: A Plus ICT students use
// This catalogue has no matching Robotics course track.
const students = Object.freeze([
  { name: "G.V.Sinura Sandali Vithanage Sinura", email: "mro2512-0001@miraclerobotics.lk" },
  { name: "K.A.D.Thenuda Thisath Thenuda", email: "mro2512-0002@miraclerobotics.lk" },
  { name: "H.D.R.Dilon Akeesha Akeesha", email: "mro2512-0003@miraclerobotics.lk" },
  { name: "H.A.M.L.J.Hettiarachchi Minuga", email: "mro2512-0004@miraclerobotics.lk" },
  { name: "A.W.A.L.M.Abeysekara Lesandul", email: "mro2512-0005@miraclerobotics.lk" },
  { name: "A.W.A.I.J.Abeysekara Isitha", email: "mro2512-0006@miraclerobotics.lk" },
  { name: "W.M.Thiaru Mihiranjana Wendakoon Thiaru", email: "mro2512-0007@miraclerobotics.lk" },
  { name: "J.M.Romidu Sayul Jayamanna Romidu", email: "mro2512-0008@miraclerobotics.lk" },
  { name: "W.S.Geeneth Thisera Sanula", email: "mro2512-0009@miraclerobotics.lk" },
  { name: "R.A.Sandila Siththara Umesh Ranasinghe Sandila", email: "mro2512-0010@miraclerobotics.lk" },
  { name: "S.M.S.N.Gunawardhana Sehas", email: "mro2512-0011@miraclerobotics.lk" },
  { name: "J.A.Kisandu Yehas Kisandu", email: "mro2512-0012@miraclerobotics.lk" },
  { name: "S.M Senula Budmina Ranasinhe Senula", email: "mro2512-0013@miraclerobotics.lk" },
  { name: "A.Yalindu Randesh Rathnayaka Yalindu", email: "mro2512-0014@miraclerobotics.lk" },
  { name: "K.W.Sihina Sanketh Sihina", email: "mro2512-0015@miraclerobotics.lk" },
  { name: "A.M.Danuja Dinsara Adhikari Danuja", email: "mro2512-0016@miraclerobotics.lk" },
  { name: "H.A.Maheru Dilsitha Maheru", email: "mro2512-0017@miraclerobotics.lk" },
  { name: "H.A.Pahan Iduwara Jayalath Pahan", email: "mro2512-0018@miraclerobotics.lk" },
  { name: "A.M. Danuja Dinsara Adhikari Danuja", email: "danujadinsaraadhikara@gmail.com" },
  { name: "Sethun Vinmeth Sethun", email: "mro2601-0002@miraclerobotics.lk" },
  { name: "D. A.Sayumi Kithma Sayumi", email: "sayumikithma@gmail.com" },
  { name: "K.K.V.V.Videw Senhas Karunathilaka Videw", email: "videw@gmail.com" },
  { name: "N.P. Thevmika Thiven thevmika", email: "thevmika@gmail.com" },
  { name: "W. Abeeth Mindinu Wanasinghe Abeeth", email: "abeeth@gmail.com" },
  { name: "S.M. Chanithu Nimnod Sooriyamudali Chanithu", email: "chanithu@gmail.com" },
]);

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const student of students) {
      await queryInterface.sequelize.query(
        "INSERT INTO users (id, email, name, role, status, createdAt, updatedAt) SELECT ?, ?, ?, 'student', 'active', ?, ? WHERE NOT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER(?))",
        { replacements: [randomUUID(), student.email, student.name, now, now, student.email] },
      );
      await queryInterface.sequelize.query(
        "INSERT INTO student_profiles (id, userId, fullName, preferredMedium, profileStatus, createdAt, updatedAt) SELECT ?, u.id, ?, 'sinhala', 'incomplete', ?, ? FROM users u WHERE LOWER(u.email) = LOWER(?) AND NOT EXISTS (SELECT 1 FROM student_profiles p WHERE p.userId = u.id)",
        { replacements: [randomUUID(), student.name, now, now, student.email] },
      );
      await queryInterface.sequelize.query(
        "INSERT INTO user_roles (id, userId, roleId, createdAt, updatedAt) SELECT ?, u.id, r.id, ?, ? FROM users u JOIN roles r ON r.code = 'student' AND r.isActive = true WHERE LOWER(u.email) = LOWER(?) AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.userId = u.id AND ur.roleId = r.id)",
        { replacements: [randomUUID(), now, now, student.email] },
      );
    }
  },
  async down() {
    // Student records are live account data. They must never be removed by a seed rollback.
  },
};
