"use strict";

const { randomUUID } = require("crypto");
const { QueryTypes } = require("sequelize");

const topicTitle = "පාඩම 01 — අවසාන ඇගයීම";
const quizTitle = "පාඩම 01 — අවසාන පරීක්ෂණය (ප්‍රශ්න 50)";
const categorySlug = "lesson-01-final-test-50";

// This is deliberately a fixed question set: students can use the navigator to review
// all 50 questions before submitting, and results are comparable between attempts.
const questions = [
  ["දත්ත යනු කුමක්ද?", ["සැකසූ කරුණු", "අමු කරුණු සහ සංඛ්‍යා", "අවසාන වාර්තාවක්", "ප්‍රයෝජනවත් දැනුම"], 1, "දත්ත යනු තවමත් අර්ථවත් ආකාරයට සැකසී නොමැති අමු කරුණු සහ සංඛ්‍යා වේ."],
  ["තොරතුරු යනු කුමක්ද?", ["අර්ථවත් ලෙස සැකසූ දත්ත", "ගබඩා කර ඇති උපකරණ", "යතුරු පුවරුවක යතුරු", "අන්තර්ජාල සම්බන්ධතාවයක්"], 0, "දත්ත සැකසීමෙන් භාවිතා කළ හැකි අර්ථවත් තොරතුරු ලැබේ."],
  ["පන්ති ලකුණු 65, 72, 80, 55 යනු කුමක්ද?", ["තොරතුරු", "දත්ත", "දෘඩාංග", "මෘදුකාංග"], 1, "තනි ලකුණු ලැයිස්තුව අමු දත්තයකි."],
  ["‘පන්තියේ සාමාන්‍ය ලකුණ 68 යි’ යන්න කුමක්ද?", ["දත්ත", "ආදාන උපකරණයක්", "තොරතුරු", "ගබඩා උපකරණයක්"], 2, "සාමාන්‍යය ගණනය කර අර්ථවත් ප්‍රතිඵලයක් ලබා ඇති නිසා එය තොරතුරකි."],
  ["මූලික තොරතුරු සැකසුම් චක්‍රය කුමක්ද?", ["ප්‍රතිදානය → ආදානය → සැකසුම", "ආදානය → සැකසුම → ප්‍රතිදානය", "සැකසුම → ආදානය → ප්‍රතිදානය", "ආදානය → ප්‍රතිදානය → සැකසුම"], 1, "දත්ත මුලින් ඇතුළත් කර, සැකසීමෙන් පසු ප්‍රතිදානය ලබා ගනී."],
  ["හොඳ තොරතුරක අත්‍යවශ්‍ය ලක්ෂණයක් වන්නේ කුමක්ද?", ["අසත්‍ය වීම", "අදාළ හා නිවැරදි වීම", "තේරුම්ගැනීමට අපහසු වීම", "සංඛ්‍යා පමණක් තිබීම"], 1, "තොරතුරු නිවැරදි සහ අවශ්‍ය කාර්යයට අදාළ විය යුතුය."],
  ["යතුරු පුවරුවක් ප්‍රධාන වශයෙන් කුමන වර්ගයේ උපකරණයක්ද?", ["ආදාන", "ප්‍රතිදාන", "සැකසුම්", "සන්නිවේදන"], 0, "යතුරු පුවරුව පරිශීලකයාගේ දත්ත පරිගණකයට ඇතුළත් කරයි."],
  ["තිරයක් (monitor) ප්‍රධාන වශයෙන් කුමන වර්ගයේ උපකරණයක්ද?", ["ආදාන", "ප්‍රතිදාන", "ගබඩා", "සැකසුම්"], 1, "තිරය පරිගණකයේ ප්‍රතිඵල පරිශීලකයාට පෙන්වයි."],
  ["CPU හි ප්‍රධාන කාර්යය කුමක්ද?", ["දත්ත මුද්‍රණය කිරීම", "දත්ත සැකසීම සහ උපදෙස් ක්‍රියාත්මක කිරීම", "අන්තර්ජාලයට සම්බන්ධ කිරීම", "කඩදාසි ස්කෑන් කිරීම"], 1, "CPU උපදෙස් ක්‍රියාත්මක කර දත්ත සැකසීම සිදු කරයි."],
  ["පරිගණකයක තාවකාලික මතකය ලෙස හඳුන්වන්නේ කුමක්ද?", ["RAM", "Hard disk", "Printer", "Monitor"], 0, "RAM යනු වැඩ කරන අතරතුර භාවිත වන තාවකාලික මතකයයි."],
  ["විදුලිය විසන්ධි වූ විට RAM හි දත්ත සාමාන්‍යයෙන් කුමක් වේද?", ["ස්ථිරව පවතී", "නැති වේ", "මුද්‍රණය වේ", "අන්තර්ජාලයට යවයි"], 1, "RAM වාෂ්පශීලී (volatile) මතකයකි."],
  ["පහත සඳහන් දේවලින් ද්විතීය ගබඩා උපකරණයක් වන්නේ කුමක්ද?", ["Hard disk", "Mouse", "Speaker", "Scanner"], 0, "Hard disk එක දත්ත දිගු කාලයක් ගබඩා කිරීම සඳහා භාවිත වේ."],
  ["මෘදුකාංග (software) යනු කුමක්ද?", ["පරිගණකයේ භෞතික කොටස්", "පරිගණකයට දෙන උපදෙස් සහ වැඩසටහන්", "විදුලි බල සැපයුම", "දත්ත ඇතුළත් කරන පුද්ගලයන්"], 1, "මෘදුකාංග යනු පරිගණකය කළ යුතු දේ පවසන වැඩසටහන් සහ උපදෙස් වේ."],
  ["දෘඩාංග (hardware) යනු කුමක්ද?", ["ස්පර්ශ කළ හැකි පරිගණක කොටස්", "වැඩසටහන් පමණක්", "දත්තවල අර්ථය", "අන්තර්ජාල සේවාවක්"], 0, "දෘඩාංග යනු යතුරු පුවරුව, තිරය වැනි භෞතික කොටස් වේ."],
  ["මෙහෙයුම් පද්ධතියක උදාහරණයක් කුමක්ද?", ["Windows", "Keyboard", "Google", "USB cable"], 0, "Windows යනු පරිගණක දෘඩාංග හා යෙදුම් කළමනාකරණය කරන මෙහෙයුම් පද්ධතියකි."],
  ["Word processor එකක් ප්‍රධාන වශයෙන් භාවිත කරන්නේ කුමක් සඳහාද?", ["ලේඛන සකස් කිරීම", "වීඩියෝ පටිගත කිරීම", "විදුලිය සැපයීම", "දත්ත ස්කෑන් කිරීම"], 0, "Word processor මඟින් ලිපි සහ වාර්තා වැනි ලේඛන නිර්මාණය හා සංස්කරණය කළ හැක."],
  ["Spreadsheet මෘදුකාංගයක ප්‍රධාන වාසිය කුමක්ද?", ["ගණනය කිරීම් සහ වගු සකස් කිරීම", "කඩදාසි මුද්‍රණය පමණක්", "අන්තර්ජාල රැහැන් සවි කිරීම", "වෛරස් ඉවත් කිරීම පමණක්"], 0, "Spreadsheet එකක සූත්‍ර භාවිතයෙන් දත්ත ගණනය සහ විශ්ලේෂණය කළ හැක."],
  ["Database එකක් වඩාත් සුදුසු වන්නේ කුමක් සඳහාද?", ["සම්බන්ධිත දත්ත සංවිධානාත්මකව ගබඩා කිරීම", "පරිගණකය බලගැන්වීම", "ශබ්දයක් නිකුත් කිරීම", "තිරය පිරිසිදු කිරීම"], 0, "Database මඟින් දත්ත ගබඩා, සෙවීම සහ යාවත්කාලීන කිරීම පහසු වේ."],
  ["පරිගණක පද්ධතියක peopleware යනුවෙන් අදහස් කරන්නේ කාටද?", ["පද්ධතිය භාවිත කරන සහ පවත්වාගෙන යන පුද්ගලයන්ට", "පරිගණකයේ චිප් වලට", "වැඩසටහන් ගොනු වලට", "කේබල් වලට"], 0, "Peopleware යනු පරිශීලකයන්, ක්‍රමලේඛකයන් සහ අනෙකුත් මානව සම්පත් වේ."],
  ["පද්ධතියකට අවශ්‍ය නොවන කොටස කුමක්ද?", ["ආදානය", "සැකසුම", "ප්‍රතිදානය", "අනාවශ්‍ය අනුමානය"], 3, "පද්ධතියක් ආදාන, සැකසුම්, ප්‍රතිදාන හා පාලන/ප්‍රතිපෝෂණ වැනි අංග භාවිත කරයි."],
  ["පරිගණකයක ප්‍රතිපෝෂණය (feedback) යනු කුමක්ද?", ["ප්‍රතිඵලය භාවිත කර පද්ධතිය පාලනය හෝ වැඩිදියුණු කිරීම", "දත්ත මකා දැමීම", "නව දෘඩාංග මිලදී ගැනීම", "තිරය නිවා දැමීම"], 0, "ප්‍රතිපෝෂණය පද්ධතියේ ප්‍රතිඵල ඇගයීමට හා අවශ්‍ය වෙනස්කම් කිරීමට උපකාරී වේ."],
  ["Barcode reader එකක් කුමන වර්ගයේ උපකරණයක්ද?", ["ආදාන", "ප්‍රතිදාන", "ගබඩා", "සැකසුම්"], 0, "Barcode reader එක දත්ත කියවා පරිගණකයට ඇතුළත් කරයි."],
  ["Printer එකක් කුමන වර්ගයේ උපකරණයක්ද?", ["ආදාන", "ප්‍රතිදාන", "සැකසුම්", "සන්නිවේදන"], 1, "Printer එක ලේඛන කඩදාසි මත ප්‍රතිදානය කරයි."],
  ["Touch screen එකක් නිවැරදිව හඳුන්වන්නේ කෙසේද?", ["ආදාන පමණක්", "ප්‍රතිදාන පමණක්", "ආදාන සහ ප්‍රතිදාන", "ගබඩා පමණක්"], 2, "Touch screen එක දත්ත පෙන්වන අතර ස්පර්ශයෙන් ආදානයද ලබා ගනී."],
  ["ක්ෂණිකව පෙන්විය යුතු බස් පැමිණීමේ වේලාවක් සඳහා වැදගත්ම තොරතුරු ගුණාංගය කුමක්ද?", ["කාලීන වීම", "අතිශය දිගු වීම", "අලංකාර අකුරු තිබීම", "අමතර පිටු තිබීම"], 0, "වේලාවන් ඉක්මනින් වෙනස් වන නිසා කාලීන තොරතුරු අවශ්‍ය වේ."],
  ["තොරතුරක් විශ්වාස කළ හැකි ප්‍රභවයකින් ලැබීම කුමන ගුණාංගයට සම්බන්ධද?", ["විශ්වාසනීයත්වය", "අතිරික්තය", "අපැහැදිලි බව", "වර්ණය"], 0, "විශ්වාසනීය ප්‍රභවයක් තොරතුරේ ගුණාත්මකභාවය වැඩි කරයි."],
  ["දත්ත ආදානයේ දෝෂ අඩු කිරීමට භාවිත කළ හැක්කේ කුමක්ද?", ["Validation rules", "විශාල තිරයක්", "වැඩි මුද්‍රණ කඩදාසි", "Speaker"], 0, "Validation rules මඟින් ඇතුළත් කරන අගයන් පිළිගත හැකිදැයි පරීක්ෂා කරයි."],
  ["අවශ්‍ය ක්ෂේත්‍රයක් හිස්ව තිබේදැයි පරීක්ෂා කරන validation එක කුමක්ද?", ["Presence check", "Range check", "Length check", "Format check"], 0, "Presence check මඟින් අනිවාර්ය ක්ෂේත්‍රයක දත්ත ඇතුළත් කර ඇතිදැයි පරීක්ෂා කරයි."],
  ["වයස 0 සිට 120 අතර විය යුතුදැයි පරීක්ෂා කරන්නේ කුමන validation එකකින්ද?", ["Range check", "Presence check", "Type check", "Lookup check"], 0, "Range check මඟින් අගයක් අවම සහ උපරිම සීමා අතරදැයි පරීක්ෂා කරයි."],
  ["NIC අංකයක් අවශ්‍ය රටාවට තිබේදැයි පරීක්ෂා කරන්නේ කුමක් මඟින්ද?", ["Format check", "Range check", "Presence check", "Parity check"], 0, "Format check මඟින් දත්තය නියමිත ආකෘතියට ගැලපේදැයි පරීක්ෂා කරයි."],
  ["දත්ත ඇතුළත් කිරීමෙන් පසු මුල් ලේඛනය සමඟ සසඳා බලන්නේ කුමක් සඳහාද?", ["Verification", "Output", "Storage", "Encryption"], 0, "Verification මඟින් ඇතුළත් කළ දත්ත මුල් දත්තයට සමානදැයි පරීක්ෂා කරයි."],
  ["ප්‍රාථමික දත්ත (primary data) සඳහා උදාහරණයක් කුමක්ද?", ["ඔබ විසින් කළ සමීක්ෂණයක පිළිතුරු", "පුවත්පතක ලිපියක්", "පළ කළ ජනගහන වාර්තාවක්", "පැරණි වෙබ් අඩවියක දත්ත"], 0, "ප්‍රාථමික දත්ත මුල් කාර්යය සඳහා සෘජුවම එකතු කරනු ලැබේ."],
  ["ද්විතීය දත්ත (secondary data) සඳහා උදාහරණයක් කුමක්ද?", ["ජනගහන ලේඛන වාර්තාවක් භාවිත කිරීම", "ඔබම මැනූ උෂ්ණත්වයන්", "ඔබම කළ සම්මුඛ සාකච්ඡාවක්", "ඔබම ගත් ඡායාරූපයක්"], 0, "ද්විතීය දත්ත යනු වෙනත් අයෙකු හෝ ආයතනයක් මීට පෙර එකතු කළ දත්ත වේ."],
  ["දත්ත සමුදායක record එකක් සාමාන්‍යයෙන් නියෝජනය කරන්නේ කුමක්ද?", ["එක් ආයතනයක් හෝ පුද්ගලයෙක් පිළිබඳ සම්පූර්ණ තොරතුරු සමූහයක්", "තනි අකුරක්", "එක් පරිගණකයක්", "අන්තර්ජාල වේගයක්"], 0, "Record එකක fields කිහිපයක් එක් ආයතනයක් හෝ සිද්ධියක් විස්තර කරයි."],
  ["දත්ත සමුදායක field එකක් සාමාන්‍යයෙන් නියෝජනය කරන්නේ කුමක්ද?", ["එක් ගුණාංගයක්, උදාහරණයක් ලෙස නම", "සම්පූර්ණ වගුවක්", "සම්පූර්ණ ජාලයක්", "මුද්‍රණ යන්ත්‍රයක්"], 0, "Field එකක් record එකක තනි ගුණාංගයක් ගබඩා කරයි."],
  ["Primary key එකක ප්‍රධාන අරමුණ කුමක්ද?", ["එක් එක් record එක අනන්‍යව හඳුනා ගැනීම", "දත්ත වර්ණ ගැන්වීම", "තිරයේ ප්‍රමාණය වෙනස් කිරීම", "ගොනුවක් මුද්‍රණය කිරීම"], 0, "Primary key අගය එක් එක් record එක සඳහා අනන්‍ය විය යුතුය."],
  ["ගොනුවක් (file) යනු කුමක්ද?", ["සම්බන්ධිත දත්ත හෝ තොරතුරු එකතුවක්", "පරිගණකයේ ප්‍රොසෙසරය", "අන්තර්ජාල සේවාදායකය පමණක්", "මවුසය"], 0, "ගොනුවක් යනු සම්බන්ධිත දත්ත හෝ වැඩසටහන් ගබඩා කළ එකකයකි."],
  ["Backup එකක් ගැනීමේ ප්‍රධාන හේතුව කුමක්ද?", ["දත්ත නැති වුවහොත් නැවත ලබාගැනීමට", "පරිගණකය මන්දගාමී කිරීමට", "තිරයේ දීප්තිය වැඩි කිරීමට", "මවුසය අක්‍රිය කිරීමට"], 0, "Backup මඟින් අහම්බෙන් මකා දැමීම හෝ දෝෂ නිසා නැති වූ දත්ත නැවත ලබාගත හැක."],
  ["Cloud storage යනු කුමක්ද?", ["අන්තර්ජාලය හරහා දුරස්ථ සේවාදායකවල දත්ත ගබඩා කිරීම", "පරිගණකය මත පමණක් දත්ත තැබීම", "මුද්‍රිත ගොනුවක්", "RAM එකක්"], 0, "Cloud storage සේවාවන් දුරස්ථ පරිගණකවල දත්ත ගබඩා කර අන්තර්ජාලයෙන් ප්‍රවේශය ලබාදේ."],
  ["පරිගණක ජාලයක ප්‍රධාන වාසිය කුමක්ද?", ["සම්පත් සහ තොරතුරු බෙදාගැනීම", "එක් පරිගණකයක RAM අඩු කිරීම", "යතුරු පුවරුව ඉවත් කිරීම", "විදුලිය සෑදීම"], 0, "ජාලයක් මඟින් ගොනු, මුද්‍රණ යන්ත්‍ර හා අන්තර්ජාල සම්බන්ධතා බෙදාගත හැක."],
  ["LAN යන්නෙන් අදහස් කරන්නේ කුමක්ද?", ["Local Area Network", "Large Access Number", "Logical Audio Node", "Linked Application Network"], 0, "LAN එකක් කුඩා භූගෝලීය ප්‍රදේශයක, උදාහරණයක් ලෙස පාසලක, පරිගණක සම්බන්ධ කරයි."],
  ["Internet එක නිවැරදිව විස්තර කරන්නේ කෙසේද?", ["ලොව පුරා ජාල එකිනෙක සම්බන්ධ කළ ජාලයක්", "එකම පරිගණකයක මතකය", "ප්‍රින්ටරයක වර්ගයක්", "විදුලි කේබලයක්"], 0, "Internet යනු ලොව පුරා ඇති ජාල එකිනෙක සම්බන්ධ කරන විශාල ජාලයකි."],
  ["Web browser එකක ප්‍රධාන කාර්යය කුමක්ද?", ["වෙබ් පිටු ලබාගෙන පෙන්වීම", "දෘඩාංග සෑදීම", "වෛරස් නිර්මාණය", "කඩදාසි මුද්‍රණය පමණක්"], 0, "Browser එකක් වෙබ් අඩවි සහ වෙබ් යෙදුම් වෙත ප්‍රවේශය ලබාදේ."],
  ["URL එකක් භාවිත කරන්නේ කුමක් සඳහාද?", ["වෙබ් සම්පතක ලිපිනය හඳුනා ගැනීමට", "ගොනුවක් මකා දැමීමට", "CPU වේගය මැනීමට", "මුරපදයක් සෑදීමට"], 0, "URL එකක් වෙබ් පිටුවක් හෝ වෙනත් අන්තර්ජාල සම්පතක් සොයා ගැනීමට භාවිත වේ."],
  ["Email පණිවිඩයක ලබන්නාගේ ලිපිනය සාමාන්‍යයෙන් ඇතුළත් කරන්නේ කුමන ක්ෂේත්‍රයේද?", ["To", "Subject", "Attachment", "Signature"], 0, "To ක්ෂේත්‍රය ප්‍රධාන ලබන්නාගේ email ලිපිනය සඳහා භාවිත වේ."],
  ["Phishing ප්‍රහාරයක ප්‍රධාන අරමුණ කුමක්ද?", ["රැවටීමෙන් රහස් තොරතුරු ලබාගැනීම", "දත්ත backup කිරීම", "තිරය පිරිසිදු කිරීම", "ගොනු සංවිධානය කිරීම"], 0, "Phishing පණිවිඩ විශ්වාසදායක ආයතනයක් ලෙස පෙනී සිට රහස් තොරතුරු ඉල්ලා සිටිය හැක."],
  ["ශක්තිමත් මුරපදයක ලක්ෂණයක් කුමක්ද?", ["දිගු සහ අනන්‍ය වීම", "‘123456’ වැනි සරල අංකයක් වීම", "ඔබගේ නම පමණක් තිබීම", "සියලුම වෙබ් අඩවි සඳහා එකම මුරපදය වීම"], 0, "දිගු, අනන්‍ය මුරපදයක් අනවසර ප්‍රවේශ අවදානම අඩු කරයි."],
  ["Two-factor authentication (2FA) මඟින් ලබාදෙන්නේ කුමක්ද?", ["අමතර සත්‍යාපන පියවරක්", "අමතර ප්‍රින්ටරයක්", "අමතර තිරයක්", "දත්ත මකා දැමීම"], 0, "2FA මඟින් මුරපදයට අමතරව කේතයක් හෝ උපාංග තහවුරු කිරීමක් අවශ්‍ය කරයි."],
  ["Copyright ගැන නිවැරදි ප්‍රකාශය කුමක්ද?", ["අන් අයගේ නිර්මාණ අවසරයෙන් හෝ නීතිමය ලෙස භාවිත කළ යුතුය", "අන්තර්ජාලයේ ඇති සියල්ල නිදහසේ පිටපත් කළ හැක", "කර්තෘගේ නම ඉවත් කළ යුතුය", "පාසල් වැඩ සඳහා නීති නොමැත"], 0, "කර්තෘ අයිතිය නිර්මාණකරුවන්ගේ කෘති ආරක්ෂා කරයි."],
  ["Ergonomics සම්බන්ධයෙන් නිවැරදි පුරුද්ද කුමක්ද?", ["තිරය ඇස් මට්ටමට ආසන්නව තබා නිසි ඉරියව්වෙන් වැඩ කිරීම", "දිගු වේලාවක් විවේක නොගෙන වාඩිවීම", "තිරයට ඉතා සමීපව සිටීම", "අඳුරේ පමණක් වැඩ කිරීම"], 0, "නිසි ඉරියව්ව සහ නියමිත විවේක ශරීරයට වන ආතතිය අඩු කරයි."],
];

module.exports = {
  async up(queryInterface) {
    const database = queryInterface.sequelize;
    const now = new Date();
    await database.transaction(async (transaction) => {
      const one = async (sql, replacements = []) => (await database.query(sql, { replacements, type: QueryTypes.SELECT, transaction }))[0];
      const track = await one("SELECT id, courseId FROM course_tracks WHERE slug = ?", ["al-ict-sinhala"]);
      if (!track) throw new Error("The A/L ICT Sinhala track is required before the final test can be added");
      const lesson = await one("SELECT id FROM lessons WHERE trackId = ? AND lessonNumber = 1", [track.id]);
      if (!lesson) throw new Error("Lesson 01 is required before the final test can be added");
      const author = await one("SELECT id FROM users WHERE role IN ('super_admin', 'admin', 'content_editor', 'teacher') AND status = 'active' ORDER BY createdAt ASC LIMIT 1");
      if (!author) throw new Error("An active content author is required before the final test can be added");

      let topic = await one("SELECT id FROM topics WHERE lessonId = ? AND slug = ?", [lesson.id, "lesson-01-final-test"]);
      if (!topic) {
        topic = { id: randomUUID() };
        const maxTopicOrder = await one("SELECT COALESCE(MAX(sortOrder), 0) AS maxOrder FROM topics WHERE lessonId = ?", [lesson.id]);
        await queryInterface.bulkInsert("topics", [{
          id: topic.id, lessonId: lesson.id, slug: "lesson-01-final-test", title: topicTitle,
          titleEn: "Lesson 01 Final Test", titleSi: topicTitle,
          descriptionEn: "A 50-question sample final test covering Lesson 01 ICT concepts.",
          descriptionSi: "පාඩම 01 හි ඉගෙනගත් ICT සංකල්ප ආවරණය කරන ප්‍රශ්න 50ක ආදර්ශ අවසාන පරීක්ෂණයකි.",
          status: "published", sortOrder: Number(maxTopicOrder.maxOrder) + 1, isVisible: true,
          createdAt: now, updatedAt: now
        }], { transaction });
      }

      let activity = await one("SELECT id FROM lesson_sections WHERE lessonId = ? AND type = 'quiz' AND titleSi = ?", [lesson.id, quizTitle]);
      if (!activity) {
        activity = { id: randomUUID() };
        await queryInterface.bulkInsert("lesson_sections", [{
          id: activity.id, lessonId: lesson.id, topicId: topic.id, type: "quiz", title: quizTitle,
          titleEn: "Lesson 01 Final Test — 50 Question Quiz", titleSi: quizTitle,
          descriptionEn: "A sample 50-question final test for Lesson 01.",
          descriptionSi: "පාඩම 01 සඳහා ප්‍රශ්න 50ක ආදර්ශ අවසාන පරීක්ෂණයකි.",
          instructions: "සෑම ප්‍රශ්නයකටම වඩාත් නිවැරදි පිළිතුර තෝරන්න. අවසන් ප්‍රශ්නයට පැමිණි පසු පිළිතුරු සමාලෝචනය කර පරීක්ෂණය යොමු කරන්න.",
          accessPolicy: "free", completionMode: "submit", estimatedMinutes: 45, maxScore: 50, passingScore: 30,
          sortOrder: 1, isVisible: true, status: "published", publishedAt: now, createdAt: now, updatedAt: now
        }], { transaction });
      }

      let quiz = await one("SELECT id FROM quizzes WHERE lessonSectionId = ?", [activity.id]);
      if (!quiz) {
        quiz = { id: randomUUID() };
        await queryInterface.bulkInsert("quizzes", [{
          id: quiz.id, lessonSectionId: activity.id, courseId: track.courseId, courseTrackId: track.id, lessonId: lesson.id, topicId: topic.id,
          title: quizTitle, description: "පාඩම 01 සඳහා ප්‍රශ්න 50ක ආදර්ශ අවසාන පරීක්ෂණයකි.",
          instructions: "සෑම ප්‍රශ්නයකටම වඩාත් නිවැරදි පිළිතුර තෝරන්න. අවසන් ප්‍රශ්නයට පැමිණි පසු පමණක් පරීක්ෂණය යොමු කළ හැක.",
          status: "published", attemptsAllowed: 3, passPercentage: 60, shuffleQuestions: false, shuffleOptions: false,
          gradingMethod: "highest", feedbackMode: "after_submission", showCorrectAnswers: true, showScore: true,
          showExplanations: true, completionRequiresPass: false, createdByUserId: author.id, updatedByUserId: author.id,
          publishedAt: now, createdAt: now, updatedAt: now
        }], { transaction });
      }

      let category = await one("SELECT id FROM question_categories WHERE courseTrackId = ? AND slug = ?", [track.id, categorySlug]);
      if (!category) {
        category = { id: randomUUID() };
        await queryInterface.bulkInsert("question_categories", [{
          id: category.id, courseId: track.courseId, courseTrackId: track.id, lessonId: lesson.id, topicId: topic.id, parentCategoryId: null,
          name: "පාඩම 01 — අවසාන පරීක්ෂණය", slug: categorySlug, description: "Lesson 01 sample final-test questions.",
          status: "published", sortOrder: 1000, createdByUserId: author.id, updatedByUserId: author.id, createdAt: now, updatedAt: now
        }], { transaction });
      }

      for (const [index, [questionText, options, correct, explanation]] of questions.entries()) {
        let question = await one("SELECT id FROM questions WHERE questionCategoryId = ? AND questionText = ?", [category.id, questionText]);
        if (!question) {
          question = { id: randomUUID() };
          await queryInterface.bulkInsert("questions", [{
            id: question.id, questionCategoryId: category.id, courseId: track.courseId, courseTrackId: track.id, lessonId: lesson.id, topicId: topic.id,
            questionType: "single_choice", title: `ප්‍රශ්නය ${index + 1}`, questionText, questionTextFormat: "html", difficulty: "easy",
            defaultMarks: 1, explanation, status: "published", version: 1, createdByUserId: author.id, updatedByUserId: author.id,
            publishedAt: now, createdAt: now, updatedAt: now
          }], { transaction });
          await queryInterface.bulkInsert("question_options", options.map((optionText, optionIndex) => ({
            id: randomUUID(), questionId: question.id, optionText, optionTextFormat: "html", isCorrect: optionIndex === correct,
            sortOrder: optionIndex + 1, createdAt: now, updatedAt: now
          })), { transaction });
        }
        const linked = await one("SELECT id FROM quiz_questions WHERE quizId = ? AND questionId = ?", [quiz.id, question.id]);
        if (!linked) await queryInterface.bulkInsert("quiz_questions", [{
          id: randomUUID(), quizId: quiz.id, questionId: question.id, marks: 1, sortOrder: index + 1,
          isRequired: true, createdAt: now, updatedAt: now
        }], { transaction });
      }
    });
  },

  async down(queryInterface) {
    const database = queryInterface.sequelize;
    await database.transaction(async (transaction) => {
      const category = (await database.query("SELECT id FROM question_categories WHERE slug = ?", { replacements: [categorySlug], type: QueryTypes.SELECT, transaction }))[0];
      if (category) {
        const questionIds = (await database.query("SELECT id FROM questions WHERE questionCategoryId = ?", { replacements: [category.id], type: QueryTypes.SELECT, transaction })).map((row) => row.id);
        if (questionIds.length) {
          await queryInterface.bulkDelete("quiz_questions", { questionId: questionIds }, { transaction });
          await queryInterface.bulkDelete("question_options", { questionId: questionIds }, { transaction });
          await queryInterface.bulkDelete("questions", { id: questionIds }, { transaction });
        }
        await queryInterface.bulkDelete("question_categories", { id: category.id }, { transaction });
      }
      const activities = await database.query("SELECT id FROM lesson_sections WHERE type = 'quiz' AND titleSi = ?", { replacements: [quizTitle], type: QueryTypes.SELECT, transaction });
      const activityIds = activities.map((row) => row.id);
      if (activityIds.length) {
        await queryInterface.bulkDelete("quizzes", { lessonSectionId: activityIds }, { transaction });
        await queryInterface.bulkDelete("lesson_sections", { id: activityIds }, { transaction });
      }
      await queryInterface.bulkDelete("topics", { slug: "lesson-01-final-test" }, { transaction });
    });
  }
};
