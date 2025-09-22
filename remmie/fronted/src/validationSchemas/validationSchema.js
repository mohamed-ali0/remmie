import * as yup from 'yup';
import axios from 'axios';


export const loginSchema = yup.object().shape({
  email: yup.string().email('Invalid email format').required('Email is required'),
  password: yup.string().required('Password is required'),
});

export const signupSchema = yup.object().shape({
  first_name: yup.string().required('First name is required'),
  last_name: yup.string().required('Last name is required'),
  mobile: yup.string().required('Mobile number is required'),
  email: yup
    .string()
    .email('Invalid email format')
    .required('Email is required')
    .test('check-email', 'Email already registered', async (value) => {
      if (value) {
        try {
          const checkRes = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/check-email`, { email: value });
          return !checkRes.data.exists; // Return false if email exists, true if it doesn't
        } catch (error) {
          console.error('Error checking email:', error);
          return false; // Return false in case of error (you can handle this case differently)
        }
      }
      return true;
    }),
  password: yup
    .string()
    .min(6, 'Minimum 6 characters required')
    .required('Password is required'),
});