const asyncForEach = async (
  array: [any],
  cb: (arg0: any, arg1: number, arg2: [any]) => void
) => {
  for (let i = 0; i < array.length; i++) {
    await cb(array[i], i, array);
  }
};

module.exports = asyncForEach;
