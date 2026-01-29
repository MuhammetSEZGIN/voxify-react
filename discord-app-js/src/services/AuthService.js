import api from "./api";

/**
 * Login user
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.userName - Username
 * @param {string} credentials.password - Password
 * @returns {Promise<{token: string, refreshToken: string, user: Object}>}
 */
async function login(userData) {
  try {
    const response = await api.post("/auth/login", userData);
    return response.data;
  } catch (error) {
    console.error("login error", error.response?.data || error.message);
    throw new Error(
      error.response?.message || error.message || "Unknown error"
    );
  }
}

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.userName - Username
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Password
 * @param {string} userData.fullName - Full name
 * @param {string} [userData.avatarUrl] - Optional avatar URL
 * @returns {Promise<{userId: string, token: string, refreshToken: string}>}
 */
const register = async (userData) => {
  try {
    const response = await api.post("/auth/register", userData);
    return response.data;
  } catch (error) {
    console.error("Registration error", error.response?.data || error.message);
    throw new Error(
      error.response?.message || error.message || "Unknown error"
    );
  }
};

/**
 * Refresh authentication token
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<{token: string, refreshToken: string}>}
 */
export const refreshToken = async (userId, refreshToken) => {
  try {
    const response = await api.post('/Auth/refresh-token', { userId, refreshToken });
    if (response.data.isSuccessfull) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Token refresh failed');
  } catch (error) {
    throw new Error(error.response?.message || error.message || "Unknown error"
    );
  }
};



  /**
   * Logout from a specific session
   * @param {string} sessionId - Session ID to logout
   * @returns {Promise<{message: string}>}
   */
  export const logoutSession = async (sessionId) => {
    try {
      const response = await api.post(`/Auth/logout-session/${sessionId}`);
      if (response.data.isSuccessfull) {
        return response.data;
      }
      throw new Error(response.data.message || 'Logout failed');
    } catch (error) {
      throw new Error(error.response?.message || error.message || "Unknown error"
      );
    }
  };



  const AuthService = {
    login,
    register,
    logoutSession,
  };

  export { AuthService };
  export default AuthService;
