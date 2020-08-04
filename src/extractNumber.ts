export {};
const extractNumber = (str: string) => {
  const numReg = new RegExp(/(\d+)/g);
  const extractedNum = str.match(numReg);
  if (extractedNum) {
    return parseInt(extractedNum.join(""), 10);
  }
  return undefined;
};

module.exports = extractNumber;
