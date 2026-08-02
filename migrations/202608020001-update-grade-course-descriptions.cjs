"use strict";

const descriptions = {
  GRADE_6: {
    en: "Start building essential ICT knowledge through guided lessons on using digital devices, basic computer concepts, and safe technology habits.",
    si: "ඩිජිටල් උපකරණ භාවිතය, මූලික පරිගණක සංකල්ප සහ ආරක්ෂිත තාක්ෂණ භාවිතය පිළිබඳ මඟපෙන්වන පාඩම් සමඟ ICT පදනම ගොඩනඟන්න.",
  },
  GRADE_7: {
    en: "Build on your ICT foundation with practical digital skills, organised lessons, and activities that connect technology to everyday learning.",
    si: "ප්‍රායෝගික ඩිජිටල් කුසලතා, සංවිධානාත්මක පාඩම් සහ දෛනික ඉගෙනීමට තාක්ෂණය සම්බන්ධ කරන ක්‍රියාකාරකම් සමඟ ඔබේ ICT පදනම තවදුරටත් ශක්තිමත් කරන්න.",
  },
  GRADE_8: {
    en: "Strengthen your understanding of ICT concepts through structured lessons, practical tasks, and problem-solving activities.",
    si: "ව්‍යුහගත පාඩම්, ප්‍රායෝගික කාර්යයන් සහ ගැටලු විසඳීමේ ක්‍රියාකාරකම් මඟින් ICT සංකල්ප පිළිබඳ ඔබේ අවබෝධය ශක්තිමත් කරන්න.",
  },
  GRADE_9: {
    en: "Prepare for upper-school ICT with stronger digital skills, clear concepts, and practical learning activities.",
    si: "වඩා ශක්තිමත් ඩිජිටල් කුසලතා, පැහැදිලි සංකල්ප සහ ප්‍රායෝගික ඉගෙනුම් ක්‍රියාකාරකම් සමඟ ඉහළ ශ්‍රේණිවල ICT සඳහා සූදානම් වන්න.",
  },
  GRADE_10: {
    en: "Develop O/L ICT knowledge with structured lessons that build understanding, practical skills, and confidence for school assessments.",
    si: "අවබෝධය, ප්‍රායෝගික කුසලතා සහ පාසල් ඇගයීම් සඳහා විශ්වාසය ගොඩනඟන ව්‍යුහගත පාඩම් සමඟ O/L ICT දැනුම වර්ධනය කරන්න.",
  },
  GRADE_11: {
    en: "Consolidate O/L ICT learning through focused lessons, practical activities, and revision support for examination preparation.",
    si: "විභාග සූදානම සඳහා ඉලක්කගත පාඩම්, ප්‍රායෝගික ක්‍රියාකාරකම් සහ පුනරීක්ෂණ සහාය මඟින් ඔබේ O/L ICT ඉගෙනුම තහවුරු කරන්න.",
  },
};

module.exports = {
  async up(queryInterface) {
    for (const [levelCode, copy] of Object.entries(descriptions)) {
      await queryInterface.sequelize.query(
        `UPDATE courses
         INNER JOIN academic_levels ON academic_levels.id = courses.academicLevelId
         SET courses.description = :description,
             courses.shortDescriptionEn = :description,
             courses.shortDescriptionSi = :descriptionSi,
             courses.updatedAt = NOW()
         WHERE academic_levels.code = :levelCode`,
        { replacements: { description: copy.en, descriptionSi: copy.si, levelCode } },
      );
    }
  },
  async down() {},
};
