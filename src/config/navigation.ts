import { ModuleId } from '../types/models';

export interface NavigationItem {
  id: ModuleId;
  labelBn: string;
  shortLabelBn: string;
  descriptionBn: string;
  iconName:
    | 'LayoutDashboard'
    | 'Scissors'
    | 'CalendarRange'
    | 'FileSpreadsheet'
    | 'ClipboardCheck'
    | 'Banknote'
    | 'HandCoins'
    | 'PiggyBank'
    | 'ArrowLeftRight'
    | 'BarChart3'
    | 'Database'
    | 'Settings';
  groupBn: 'প্রধান মডিউল' | 'আর্থিক ব্যবস্থাপনা' | 'বিশ্লেষণ ও সিস্টেম';
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: ModuleId.DASHBOARD,
    labelBn: 'ড্যাশবোর্ড',
    shortLabelBn: 'ড্যাশবোর্ড',
    descriptionBn: 'দৈনিক ও সাপ্তাহিক (শনিবার-বৃহস্পতিবার) প্রোডাকশন এবং আর্থিক হিসাবের সারসংক্ষেপ',
    iconName: 'LayoutDashboard',
    groupBn: 'প্রধান মডিউল',
  },
  {
    id: ModuleId.PRODUCTION,
    labelBn: 'প্রোডাকশন হিসাব',
    shortLabelBn: 'প্রোডাকশন',
    descriptionBn: 'প্রতিদিনের সেলাইকৃত পোশাক, কাজের শুরু/শেষ সময়, স্ট্যাটাস এবং মজুরির পূর্ণাঙ্গ খতিয়ান',
    iconName: 'Scissors',
    groupBn: 'প্রধান মডিউল',
  },
  {
    id: ModuleId.WEEKLY_REPORT,
    labelBn: 'সাপ্তাহিক রিপোর্ট (শনি-বৃহঃ)',
    shortLabelBn: 'সাপ্তাহিক',
    descriptionBn: 'শনিবার থেকে বৃহস্পতিবার পর্যন্ত সাপ্তাহিক প্রোডাকশন রিপোর্ট ও বহু-সপ্তাহের তুলনামূলক চার্ট',
    iconName: 'CalendarRange',
    groupBn: 'প্রধান মডিউল',
  },
  {
    id: ModuleId.INCOME_EXPENSE,
    labelBn: 'আয়-ব্যয়',
    shortLabelBn: 'আয়-ব্যয়',
    descriptionBn: 'দৈনন্দিন ব্যক্তিগত ও পারিবারিক আয় এবং খরচের খাতওয়ারি হিসাব',
    iconName: 'ArrowLeftRight',
    groupBn: 'প্রধান মডিউল',
  },
  {
    id: ModuleId.WAGES,
    labelBn: 'মজুরি ও পাওনা',
    shortLabelBn: 'মজুরি',
    descriptionBn: 'গার্মেন্টস কোম্পানি থেকে অর্জিত মজুরি, পরিশোধিত টাকা ও বকেয়া পাওনার হিসাব',
    iconName: 'ClipboardCheck',
    groupBn: 'প্রধান মডিউল',
  },
  {
    id: ModuleId.PAYMENTS,
    labelBn: 'টাকা উত্তোলন',
    shortLabelBn: 'উত্তোলন',
    descriptionBn: 'সাপ্তাহিক ও মাসিক মজুরি উত্তোলন এবং পেমেন্ট ভাউচারের তালিকা',
    iconName: 'Banknote',
    groupBn: 'প্রধান মডিউল',
  },
  {
    id: ModuleId.LOANS,
    labelBn: 'ঋণের হিসাব',
    shortLabelBn: 'ঋণ',
    descriptionBn: 'ব্যক্তিগত পাওনা ঋণ এবং দেনা ঋণের কিস্তি ও স্থিতি ব্যবস্থাপনা',
    iconName: 'HandCoins',
    groupBn: 'আর্থিক ব্যবস্থাপনা',
  },
  {
    id: ModuleId.FUNDS,
    labelBn: 'ফান্ড ম্যানেজমেন্ট',
    shortLabelBn: 'ফান্ড',
    descriptionBn: 'ডিপিএস, জরুরি সঞ্চয়, ঈদ ফান্ড ও পারিবারিক তহবিলের ব্যালেন্স',
    iconName: 'PiggyBank',
    groupBn: 'আর্থিক ব্যবস্থাপনা',
  },
  {
    id: ModuleId.REPORTS,
    labelBn: 'রিপোর্ট',
    shortLabelBn: 'রিপোর্ট',
    descriptionBn: 'তারিখ ও মাসভিত্তিক প্রোডাকশন, মজুরি এবং আয়-ব্যয়ের বিস্তারিত প্রতিবেদন',
    iconName: 'BarChart3',
    groupBn: 'বিশ্লেষণ ও সিস্টেম',
  },
  {
    id: ModuleId.DATA_MANAGEMENT,
    labelBn: 'ডেটা ম্যানেজমেন্ট',
    shortLabelBn: 'ডেটা',
    descriptionBn: 'সুপাবেস ক্লাউড ডাটাবেস কাঠামো, মাইগ্রেশন এবং এক্সপোর্ট ব্যবস্থাপনা',
    iconName: 'Database',
    groupBn: 'বিশ্লেষণ ও সিস্টেম',
  },
  {
    id: ModuleId.SETTINGS,
    labelBn: 'সেটিংস',
    shortLabelBn: 'সেটিংস',
    descriptionBn: 'অপারেটর প্রোফাইল, থিম (লাইট/ডার্ক), ব্যাকআপ, অ্যাপ ইনস্টল ও কনফিগারেশন',
    iconName: 'Settings',
    groupBn: 'বিশ্লেষণ ও সিস্টেম',
  },
];

export const MOBILE_PRIMARY_NAV_IDS: ModuleId[] = [
  ModuleId.DASHBOARD,
  ModuleId.PRODUCTION,
  ModuleId.WEEKLY_REPORT,
  ModuleId.INCOME_EXPENSE,
];

export const GARMENT_ITEM_NAME_OPTIONS: string[] = [];

export const GARMENT_CATEGORY_OPTIONS: string[] = [
  'কটি',
  'গোলগোলা',
  'শার্ট',
  'প্যান্ট',
];

export const GARMENT_TYPE_OPTIONS: string[] = GARMENT_CATEGORY_OPTIONS;

export const GARMENT_SIZE_OPTIONS: string[] = [
  '১৪',
  '১৬',
  '১৮',
  '২০',
  '২২',
  '২৪',
  '২৬',
  '২৮',
  '৩০',
  '৩১',
  '৩২',
];

export const GARMENT_COLOR_OPTIONS: string[] = [
  'সাদা (White)',
  'কালো (Black)',
  'নেভি ব্লু (Navy Blue)',
  'অলিভ গ্রিন (Olive Green)',
  'মেরুন (Maroon)',
  'অ্যাশ / গ্রে (Heather Grey)',
  'রয়েল ব্লু (Royal Blue)',
  'লাল (Red)',
  'হলুদ / মাস্টার্ড (Mustard)',
];

export const PAYMENT_METHOD_OPTIONS: string[] = [
  'নগদ ক্যাশ (Cash)',
  'বিকাশ (bKash)',
  'নগদ মোবাইল ব্যাংকিং (Nagad)',
  'রকেট (Rocket)',
  'ব্যাংক অ্যাকাউন্ট (Bank Transfer)',
];

export const EXPENSE_CATEGORY_OPTIONS: string[] = [
  'ঘর ভাড়া ও বিল',
  'বাজার ও খাদ্য',
  'যাতায়াত ভাড়া',
  'চিকিৎসা ও ওষুধ',
  'পরিবারে টাকা পাঠানো',
  'মোবাইল ও ইন্টারনেট রিচার্জ',
  'শিক্ষা ও সন্তানদের খরচ',
  'অন্যান্য ব্যক্তিগত খরচ',
];

export const INCOME_CATEGORY_OPTIONS: string[] = [
  'গার্মেন্টস মজুরি উত্তোলন',
  'ওভারটাইম ও হাজিরা বোনাস',
  'ঈদ ও উৎসব বোনাস',
  'অন্যান্য আয়',
];
