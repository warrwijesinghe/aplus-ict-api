"use strict";

const summaries = {
  "grade-10-ict-english": [
    "Discover how ICT supports communication, work, and everyday life.",
    "Identify the hardware and software parts that make a computer work.",
    "See how text, numbers, images, and sound are stored digitally.",
    "Use logic gates and Boolean rules to model simple digital decisions.",
    "Understand how an operating system manages files, devices, and programs.",
    "Create and format clear documents with word-processing tools.",
    "Organise calculations and information using formulas and charts.",
    "Design effective slide presentations for a clear audience message.",
    "Store, organise, and retrieve information with basic database tools."
  ],
  "grade-10-ict-sinhala": [
    "තොරතුරු හා සන්නිවේදන තාක්ෂණය දෛනික ජීවිතයට උපකාර වන ආකාරය හඳුනා ගන්න.",
    "පරිගණකයක දෘඩාංග හා මෘදුකාංග කොටස් එකට ක්‍රියා කරන ආකාරය ඉගෙන ගන්න.",
    "අකුරු, සංඛ්‍යා, රූප සහ ශබ්ද පරිගණකය තුළ නිරූපණය වන ආකාරය තේරුම් ගන්න.",
    "තාර්කික ද්වාර සහ බූලීය වීජ ගණිතයෙන් සරල තීරණ ආකෘතිගත කරන්න.",
    "මෙහෙයුම් පද්ධතිය මඟින් ගොනු, උපාංග සහ වැඩසටහන් කළමනාකරණය කරන ආකාරය හඳුනා ගන්න.",
    "වදන් සැකසුම් මෙවලම් භාවිතයෙන් පැහැදිලි ලේඛන සකස් කරන්න.",
    "සූත්‍ර සහ ප්‍රස්තාර භාවිතයෙන් දත්ත සංවිධානය කර විශ්ලේෂණය කරන්න.",
    "අදහස් පැහැදිලිව ඉදිරිපත් කිරීමට සාර්ථක සමර්පණ සකස් කරන්න.",
    "දත්ත සමුදායක් තුළ තොරතුරු ගබඩා කර සොයාගන්නා ආකාරය ඉගෙන ගන්න."
  ],
  "grade-11-ict-english": [
    "Plan and write programs that solve simple real-world problems.",
    "Follow the stages used to plan, build, test, and improve a system.",
    "Use internet and email services safely for effective communication.",
    "Combine text, sound, images, and video to communicate ideas.",
    "Build simple multimedia web pages with purposeful design choices.",
    "Consider how ICT affects people, work, privacy, and society."
  ],
  "grade-11-ict-sinhala": [
    "සැබෑ ජීවිත ගැටලු විසඳීමට සරල ක්‍රමලේඛ සැලසුම් කර ලියන්න.",
    "තොරතුරු පද්ධතියක් සැලසුම් කිරීමේ සිට පරීක්ෂා කිරීම දක්වා පියවර හඳුනා ගන්න.",
    "අන්තර්ජාලය හා විද්‍යුත් තැපෑල ආරක්ෂිතව සහ කාර්යක්ෂමව භාවිතා කරන්න.",
    "අදහස් ඉදිරිපත් කිරීමට පෙළ, ශබ්ද, රූප සහ වීඩියෝ එකට භාවිතා කරන්න.",
    "බහුමාධ්‍ය අංග යොදා සරල හා පැහැදිලි වෙබ් අඩවි නිර්මාණය කරන්න.",
    "සමාජයට, පෞද්ගලිකත්වයට සහ රැකියා ලෝකයට ICT බලපාන ආකාරය විමසා බලන්න."
  ],
  "grade-6-ict-english": [
    "Recognise why computers are useful in learning and daily life.",
    "Use the computer laboratory safely, carefully, and responsibly.",
    "Explore the operating system and keep files neatly organised.",
    "Use the mouse and keyboard confidently in common applications.",
    "Break a problem into steps with simple algorithms and flowcharts.",
    "Use the internet responsibly to find information and communicate."
  ],
  "grade-6-ict-sinhala": [
    "ඉගෙනීමට හා දෛනික ජීවිතයට පරිගණක වැදගත් වන ආකාරය හඳුනා ගන්න.",
    "පරිගණක විද්‍යාගාරය ආරක්ෂිතව, සැලකිල්ලෙන් සහ වගකීමෙන් භාවිතා කරන්න.",
    "මෙහෙයුම් පද්ධතිය හඳුනාගෙන ගොනු පිළිවෙළට සංවිධානය කරන්න.",
    "මූසිකය හා යතුරුපුවරුවෙන් සාමාන්‍ය යෙදුම් විශ්වාසයෙන් භාවිතා කරන්න.",
    "ගැටලු පියවරවලට බෙදා සරල ඇල්ගොරිතම හා ගැලීම් සටහන් සකස් කරන්න.",
    "තොරතුරු සෙවීමට හා සන්නිවේදනයට අන්තර්ජාලය වගකීමෙන් භාවිතා කරන්න."
  ],
  "grade-7-ict-english": [
    "Learn how the CPU processes instructions and controls computer tasks.",
    "Explore how an operating system helps people use a computer.",
    "Protect a computer system with safe habits and basic security tools.",
    "Create well-structured documents using word-processing features.",
    "Plan a simple program by turning a problem into clear steps.",
    "Create clear visual presentations that support your message.",
    "Use internet services safely to find information and share ideas."
  ],
  "grade-7-ict-sinhala": [
    "මධ්‍ය සැකසුම් ඒකකය උපදෙස් සකසා පරිගණක කාර්ය පාලනය කරන ආකාරය හඳුනා ගන්න.",
    "මෙහෙයුම් පද්ධතිය පරිගණකය භාවිතයට උපකාර වන ආකාරය ඉගෙන ගන්න.",
    "ආරක්ෂිත පුරුදු හා සරල මෙවලම් භාවිතයෙන් පරිගණක පද්ධතිය ආරක්ෂා කරන්න.",
    "වදන් සැකසුම් අංග භාවිතයෙන් පිළිවෙළට ලේඛන සකස් කරන්න.",
    "ගැටලුවක් පැහැදිලි පියවරවලට පෙරළා සරල වැඩසටහනක් සැලසුම් කරන්න.",
    "ඔබගේ අදහස පැහැදිලි කරන ආකර්ෂණීය සමර්පණ නිර්මාණය කරන්න.",
    "තොරතුරු සොයා ගැනීමට හා අදහස් බෙදා ගැනීමට අන්තර්ජාලය ආරක්ෂිතව භාවිතා කරන්න."
  ],
  "grade-8-ict-english": [
    "Work with common number systems used to represent digital values.",
    "Configure computer settings and apply useful formatting choices.",
    "Use word-processing tools to produce polished documents.",
    "Create simple programs by planning logic and testing solutions.",
    "Connect code with real devices through practical physical computing.",
    "Browse, search, and communicate online with safe internet habits."
  ],
  "grade-8-ict-sinhala": [
    "ඩිජිටල් අගයන් නිරූපණයට භාවිත කරන සංඛ්‍යා පද්ධති සමඟ වැඩ කරන්න.",
    "පරිගණක සැකසුම් වින්‍යාස කර ප්‍රයෝජනවත් සීරුමාරු යොදන්න.",
    "වදන් සැකසුම් මෙවලම් භාවිතයෙන් නිමැවුම් සහිත ලේඛන සකස් කරන්න.",
    "තාර්කික සැලසුමක් සමඟ සරල ක්‍රමලේඛ ගොඩනඟා පරීක්ෂා කරන්න.",
    "කේතය සහ සැබෑ උපාංග සම්බන්ධ කර ප්‍රායෝගික ආගණනය අත්හදා බලන්න.",
    "ආරක්ෂිත අන්තර්ජාල පුරුදු සමඟ සොයන්න, සැරිසරන්න සහ සන්නිවේදනය කරන්න."
  ],
  "grade-9-ict-english": [
    "Choose suitable computer specifications for a user’s needs and budget.",
    "Use spreadsheets to calculate, analyse, and present data clearly.",
    "Develop programs through planning, coding, testing, and improvement.",
    "Explore how microcontrollers control simple electronic projects.",
    "Understand how devices connect and share data across networks.",
    "Discuss the benefits, responsibilities, and social impact of ICT."
  ],
  "grade-9-ict-sinhala": [
    "පරිශීලක අවශ්‍යතා හා අයවැය අනුව සුදුසු පරිගණක පිරිවිතර තෝරන්න.",
    "විද්‍යුත් පැතුරුම්පත් භාවිතයෙන් දත්ත ගණනය කර විශ්ලේෂණය හා ඉදිරිපත් කරන්න.",
    "සැලසුම් කිරීම, කේතනය, පරීක්ෂා කිරීම සහ වැඩිදියුණු කිරීමෙන් ක්‍රමලේඛ ගොඩනඟන්න.",
    "ක්ෂුද්‍ර පාලක මඟින් සරල ඉලෙක්ට්‍රොනික ව්‍යාපෘති පාලනය කරන ආකාරය අත්හදා බලන්න.",
    "ජාල හරහා උපාංග සම්බන්ධ වී දත්ත හුවමාරු කරන ආකාරය තේරුම් ගන්න.",
    "ICT හි ප්‍රතිලාභ, වගකීම් සහ සමාජ බලපෑම් පිළිබඳව විමසා බලන්න."
  ]
};

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const [trackSlug, entries] of Object.entries(summaries)) {
      for (const [index, summary] of entries.entries()) {
        await queryInterface.sequelize.query(
          `UPDATE lessons
           INNER JOIN course_tracks ON course_tracks.id = lessons.trackId
           SET lessons.summary = :summary, lessons.updatedAt = :now
           WHERE course_tracks.slug = :trackSlug
             AND lessons.lessonNumber = :lessonNumber`,
          {
            replacements: {
              trackSlug,
              lessonNumber: index + 1,
              summary,
              now
            }
          }
        );
      }
    }
  },

  async down() {
    // Editorial copy is intentionally retained on rollback.
  }
};
