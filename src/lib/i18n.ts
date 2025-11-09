export type Language = 'en' | 'zh';

export interface Translations {
  [key: string]: string;
}

const translations: Record<Language, Translations> = {
  en: {
    // Landing Page
    'app.title': 'Instant Messenger',
    'app.subtitle': 'Create or join private chat rooms instantly',
    'createRoom.title': 'Create Room',
    'createRoom.description': 'Start a new private chat room and invite your friends',
    'createRoom.button': 'Create Room',
    'createRoom.note': 'Requires login',
    'joinRoom.title': 'Join Room',
    'joinRoom.description': 'Join an existing room with ID and passcode',
    'joinRoom.button': 'Join Room',
    'joinRoom.note': 'No login required',
    'app.features': 'Secure • Private • Instant',
    
    // Login Page
    'login.title': 'Login',
    'login.subtitle': 'Login to create chat rooms',
    'login.email': 'Email Address',
    'login.password': 'Password',
    'login.button': 'Login',
    'login.noAccount': "Don't have an account?",
    'login.signupHere': 'Sign up here',
    'login.note': 'Only room creators need to login. Other users can join rooms using the room ID and passcode.',
    
    // Signup Page
    'signup.title': 'Create Account',
    'signup.subtitle': 'Sign up to create chat rooms',
    'signup.name': 'Your Name',
    'signup.email': 'Email Address',
    'signup.password': 'Password',
    'signup.confirmPassword': 'Confirm Password',
    'signup.button': 'Sign Up',
    'signup.hasAccount': 'Already have an account?',
    'login.here': 'Login here',
    
    // Common
    'backToHome': 'Back to Home',
    'required': 'Required',
    'invalidEmail': 'Invalid email address',
    'passwordMismatch': 'Passwords do not match',
    'passwordTooShort': 'Password must be at least 6 characters',
    'loading': 'Loading...',
    'error': 'Error',
    'success': 'Success',
    'continue': 'Continue',
    'cancel': 'Cancel',
    'back': 'Back',
  },
  zh: {
    // Landing Page
    'app.title': '即时通讯',
    'app.subtitle': '即时创建或加入私人聊天室',
    'createRoom.title': '创建房间',
    'createRoom.description': '创建新的私人聊天室并邀请朋友',
    'createRoom.button': '创建房间',
    'createRoom.note': '需要登录',
    'joinRoom.title': '加入房间',
    'joinRoom.description': '使用房间ID和密码加入现有房间',
    'joinRoom.button': '加入房间',
    'joinRoom.note': '无需登录',
    'app.features': '安全 • 私密 • 即时',
    
    // Login Page
    'login.title': '登录',
    'login.subtitle': '登录以创建聊天室',
    'login.email': '电子邮箱',
    'login.password': '密码',
    'login.button': '登录',
    'login.noAccount': '还没有账户？',
    'login.signupHere': '在此注册',
    'login.note': '只有创建房间的用户需要登录。其他用户可以使用房间ID和密码加入。',
    
    // Signup Page
    'signup.title': '创建账户',
    'signup.subtitle': '注册以创建聊天室',
    'signup.name': '您的姓名',
    'signup.email': '电子邮箱',
    'signup.password': '密码',
    'signup.confirmPassword': '确认密码',
    'signup.button': '注册',
    'signup.hasAccount': '已有账户？',
    'login.here': '在此登录',
    
    // Common
    'backToHome': '返回首页',
    'required': '必填',
    'invalidEmail': '无效的邮箱地址',
    'passwordMismatch': '密码不匹配',
    'passwordTooShort': '密码至少6个字符',
    'loading': '加载中...',
    'error': '错误',
    'success': '成功',
    'continue': '继续',
    'cancel': '取消',
    'back': '返回',
  },
};

export const detectLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en';
  
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) return 'zh';
  return 'en';
};

export const getTranslation = (key: string, language: Language = detectLanguage()): string => {
  return translations[language][key] || translations.en[key] || key;
};

export const t = getTranslation;