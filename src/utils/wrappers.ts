export const asyncHandler = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      if (e.code) {
        console.log(e.message);
        return res.status(400).json({
          message: "database error",
        });
      } else {
        console.log(e.message);
        return res.status(500).json({
          message: "server error",
        });
      }
    }
  };
};
