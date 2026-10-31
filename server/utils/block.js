import User from "../models/user.model.js";

// A ne B ko ya B ne A ko block kiya ho to true
export const isBlocked = async (a, b) => {
  const found = await User.exists({
    $or: [
      { _id: a, blockedUsers: b },
      { _id: b, blockedUsers: a },
    ],
  });
  return !!found;
};
