// src/utils/auth.js
export function getToken() {
  return localStorage.getItem('token');
}

export function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    return true;
  }
}

export function checkAndLogoutIfExpired(navigate) {
  const token = localStorage.getItem('token');
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('user_profile');
    navigate('/sign-in');
    return true; // Logged out
  }
  return false; // Token valid
}


export function handleAuthCheck(navigate, setIsLoggedIn, setProfileImage = null) {
  const token = localStorage.getItem('token');
  const profileUrl = localStorage.getItem('user_profile');

  if (token && !isTokenExpired(token)) {
    setIsLoggedIn(true);
    if (setProfileImage && profileUrl) {
      setProfileImage(profileUrl);
    }
  } else {
    setIsLoggedIn(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user_profile');
    navigate('/');
  }
}