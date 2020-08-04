export {};
const asyncForEach = async (
  array: string[],
  cb: (arg0: number, arg1: string) => void
) => {
  for (let i = 0; i < array.length; i++) {
    await cb(i, array[i]);
  }
};

module.exports = asyncForEach;
