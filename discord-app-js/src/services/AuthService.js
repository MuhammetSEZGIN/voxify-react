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
    const response = await api.post("/identity/login", userData);
    const result = response.data;
    console.log("login data:", result);

    if (!result.isSuccessfull) {
      throw new Error(result.message || "Login failed");
    }

    return result.data ?? result;
  } catch (error) {
    // Backend'den gelen hata mesajını yakala
    const msg = error.response?.data?.message || error.message || "Unknown error";
    console.error("login error", msg);
    throw new Error(msg);
  }
}

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.userName - Username
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Password
 * @param {string} userData.passwordConfirmation - Password confirmation
 * @param {string} [userData.avatarUrl] - Optional avatar URL
 * @param {string} [userData.deviceInfo] - Optional device info
 * @returns {Promise<{userId: string, token: string, refreshToken: string}>}
 */
const register = async (userData) => {
  try {
    const response = await api.post("/identity/register", userData);
    const result = response.data;

    if (!result.isSuccessfull) {
      throw new Error(result.message || "Registration failed");
    }

    return result.data ?? result;
  } catch (error) {
    const msg = error.response?.data?.message || error.message || "Unknown error";
    console.error("Registration error", msg);
    throw new Error(msg);
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
    const response = await api.post('/identity/refresh-token', { userId, refreshToken });
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
      const response = await api.post(`/identity/logout-session/${sessionId}`);
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
