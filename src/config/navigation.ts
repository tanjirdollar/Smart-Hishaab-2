import { ModuleId } from '../types/models';

export interface NavigationItem {
  id: ModuleId;
  labelBn: string;
  shortLabelBn: string;
  descriptionBn: string;
  iconName:
    | 'LayoutDashboard'
    | 'Scissors'
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
    descriptionBn: 'দৈনিক, সাপ্তাহিক ও মাসিক প্রোডাকশন এবং আর্থিক হিসাবের সারসংক্ষেপ',
    iconName: 'LayoutDashboard',
    groupBn: 'প্রধান মডিউল',
  },
  {
    id: ModuleId.PRODUCTION,
    labelBn: 'প্রোডাকশন হিসাব',
    shortLabelBn: 'প্রোডাকশন',
    descriptionBn: 'প্রতিদিনের সেলাইকৃত পোশাকের ডজন, পিস, দর এবং ছবির পূর্ণাঙ্গ খতিয়ান',
    iconName: 'Scissors',
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
    id: ModuleId.INCOME_EXPENSE,
    labelBn: 'আয়-ব্যয়',
    shortLabelBn: 'আয়-ব্যয়',
    descriptionBn: 'দৈনন্দিন ব্যক্তিগত ও পারিবারিক আয় এবং খরচের খাতওয়ারি হিসাব',
    iconName: 'ArrowLeftRight',
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
    descriptionBn: 'সুপাবেস ক্লাউড ডাটাবেস কাঠামো, ব্যাকআপ এবং এক্সপোর্ট ব্যবস্থাপনা',
    iconName: 'Database',
    groupBn: 'বিশ্লেষণ ও সিস্টেম',
  },
  {
    id: ModuleId.SETTINGS,
    labelBn: 'সেটিংস',
    shortLabelBn: 'সেটিংস',
    descriptionBn: 'অপারেটর প্রোফাইল, থিম (লাইট/ডার্ক), মুদ্রা ও অ্যাপ্লিকেশন কনফিগারেশন',
    iconName: 'Settings',
    groupBn: 'বিশ্লেষণ ও সিস্টেম',
  },
];

export const MOBILE_PRIMARY_NAV_IDS: ModuleId[] = [
  ModuleId.DASHBOARD,
  ModuleId.PRODUCTION,
  ModuleId.WAGES,
  ModuleId.INCOME_EXPENSE,
];

export const GARMENT_TYPE_OPTIONS: string[] = [
  'টি-শার্ট (T-Shirt)',
  'পোলো শার্ট (Polo Shirt)',
  'ওভেন শার্ট (Woven Shirt)',
  'ডেনিম প্যান্ট (Denim Pant)',
  'গ্যাবার্ডিন প্যান্ট (Gabardine Pant)',
  'ট্রাউজার / জগার্স (Trouser / Joggers)',
  'হুডি / জ্যাকেট (Hoodie / Jacket)',
  'লেডিস টপস / কুর্তি (Ladies Tops)',
  'শিশুদের পোশাক (Kids Wear)',
];

export const GARMENT_SIZE_OPTIONS: string[] = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '3XL',
  '২৮-৩৬ (প্যান্ট)',
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
