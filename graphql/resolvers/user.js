import bcrypt from 'bcryptjs';

import { generateToken } from '../../utils/generate-token';

const AUTH_TOKEN_EXPIRY = '1y';
const RESET_PASSWORD_TOKEN_EXPIRY = 3600000;

const Query = {
  /**
   * Gets the currently logged in user
   */
  getAuthUser: async (root, args, { authUser, Message, User }) => {
    if (!authUser) return null;

    // If user is authenticated, update it's isOnline field to true
    const user = await User.findOneAndUpdate(
      { email: authUser.email },
      { isOnline: true }
    )
      .populate({ path: 'posts', options: { sort: { createdAt: 'desc' } } })

    return user;
  },
  /**
   * Gets user by username
   *
   * @param {string} username
   */
  getUser: async (root, { username, id }, { User }) => {
    if (!username && !id) {
      throw new Error('username or id is required params.');
    }

    if (username && id) {
      throw new Error('please pass only username or only id as a param');
    }

    const query = username ? { username: username } : { _id: id };
    const user = await User.findOne(query)
      .populate({
        path: 'posts',
        populate: [
          {
            path: 'author',
          },
        ],
        options: { sort: { createdAt: 'desc' } },
      })

    if (!user) {
      throw new Error("User with given params doesn't exists.");
    }

    return user;
  },
  
  /**
   * Searches users by username or fullName
   *
   * @param {string} searchQuery
   */
  searchUsers: async (root, { searchQuery }, { User, authUser }) => {
    // Return an empty array if searchQuery isn't presented
    if (!searchQuery) {
      return [];
    }

    const users = User.find({
      $or: [
        { username: new RegExp(searchQuery, 'i') },
        { fullName: new RegExp(searchQuery, 'i') },
      ],
      _id: {
        $ne: authUser.id,
      },
    }).limit(50);

    return users;
  },

  /**
   * Verifies reset password token
   *
   * @param {string} email
   * @param {string} token
   */
  verifyResetPasswordToken: async (root, { email, token }, { User }) => {
    // Check if user exists and token is valid
    const user = await User.findOne({
      email,
      passwordResetToken: token,
      passwordResetTokenExpiry: {
        $gte: Date.now() - RESET_PASSWORD_TOKEN_EXPIRY,
      },
    });
    if (!user) {
      throw new Error('This token is either invalid or expired!');
    }

    return { message: 'Success' };
  },
};

const Mutation = {
  /**
   * Signs in user
   *
   * @param {string} emailOrUsername
   * @param {string} password
   */
  signin: async (root, { input: { emailOrUsername, password } }, { User }) => {
    const user = await User.findOne().or([
      { email: emailOrUsername },
      { username: emailOrUsername },
    ]);

    if (!user) {
      throw new Error('User not found.');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid password.');
    }

    return {
      token: generateToken(user, process.env.SECRET, AUTH_TOKEN_EXPIRY),
    };
  },
  /**
   * Signs up user
   *
   * @param {string} fullName
   * @param {string} email
   * @param {string} username
   * @param {string} password
   */
  signup: async (
    root,
    { input: { fullName, email, username, password } },
    { User }
  ) => {
    // Check if user with given email or username already exists
    const user = await User.findOne().or([{ email }, { username }]);
    if (user) {
      const field = user.email === email ? 'email' : 'username';
      throw new Error(`User with given ${field} already exists.`);
    }

    // Empty field validation
    if (!fullName || !email || !username || !password) {
      throw new Error('All fields are required.');
    }

    // FullName validation
    if (fullName.length > 40) {
      throw new Error('Full name no more than 40 characters.');
    }
    if (fullName.length < 4) {
      throw new Error('Full name min 4 characters.');
    }

    // Email validation
    const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!emailRegex.test(String(email).toLowerCase())) {
      throw new Error('Enter a valid email address.');
    }

    // Username validation
    const usernameRegex = /^(?!.*\.\.)(?!.*\.$)[^\W][\w.]{0,29}$/;
    if (!usernameRegex.test(username)) {
      throw new Error(
        'Usernames can only use letters, numbers, underscores and periods.'
      );
    }
    if (username.length > 20) {
      throw new Error('Username no more than 50 characters.');
    }
    if (username.length < 3) {
      throw new Error('Username min 3 characters.');
    }
    const frontEndPages = [
      'forgot-password',
      'reset-password',
      'explore',
      'people',
      'notifications',
      'post',
    ];
    if (frontEndPages.includes(username)) {
      throw new Error("This username isn't available. Please try another.");
    }

    // Password validation
    if (password.length < 6) {
      throw new Error('Password min 6 characters.');
    }

    const newUser = await new User({
      fullName,
      email,
      username,
      password,
    }).save();

    return {
      token: generateToken(newUser, process.env.SECRET, AUTH_TOKEN_EXPIRY),
    };
  },
};

export default { Query, Mutation };
