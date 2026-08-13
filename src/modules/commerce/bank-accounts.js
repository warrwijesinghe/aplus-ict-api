import { ApiError } from "../../core/errors.js";

// The web client may display these accounts, but the server owns the mapping
// used for SMS so a request can never substitute arbitrary payment details.
export const bankAccounts = Object.freeze([
  { id: "nations-trust", bank: "Nations Trust Bank", branch: "Kuliyapitiya", accountName: "MIRACLE NETWORK AND SOLUTIONS (PVT) LTD", accountNumber: "200550052621" },
  { id: "ndb", bank: "NDB Bank", branch: "Kuliyapitiya", accountName: "MIRACLE NETWORK AND SOLUTIONS (PVT) LTD", accountNumber: "111000370017" },
  { id: "boc", bank: "Bank of Ceylon (BOC)", branch: "Kuliyapitiya", accountName: "WARR WIJESINGHE", accountNumber: "86208871" },
  { id: "sampath", bank: "Sampath Bank", branch: "Kuliyapitiya", accountName: "W. A. R. R. Wijesinghe", accountNumber: "1023 5303 9364" },
]);

export const findBankAccount = (id) => {
  const account = bankAccounts.find((item) => item.id === id);
  if (!account) throw new ApiError(422, "Select a valid bank account");
  return account;
};
