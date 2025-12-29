import api from "./api";

async function login(email, password) {
  try {
    const response = await api.post("/api/auth/login", {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    console.error("login error", error.response?.data || error.message);
    throw new Error(
      error.response?.message || error.message || "Unknown error"
    );
  }
}

const register = async (username, email, password) => {
  try {
    const response = await api.post("/api/auth/register", {
      username,
      email,
      password,
    });
    return response.data;
  } catch (error) {
    console.error("Registration error", error.response?.data || error.message);
    throw new Error(
      error.response?.message || error.message || "Unknown error"
    );
  }
};

const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
};

const AuthService = {
  login,
  register,
  logout,
};

export { AuthService };
export default AuthService;
