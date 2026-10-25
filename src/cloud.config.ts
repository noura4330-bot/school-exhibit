// الاتصال بقاعدة البيانات المركزية (Supabase).
// المفتاح هنا هو المفتاح العام (anon / publishable) المصمم ليكون داخل الموقع، والحماية الفعلية في سياسات القاعدة (supabase/schema.sql).
// لا يوضع هنا مفتاح service_role أو أي مفتاح سري أبدًا.
// إن بقيت القيمتان فارغتين يعمل الموقع بالحفظ المحلي في متصفح كل جهاز كما كان.
export const cloudConfig = {
  url: 'https://etnyqbnsdlcwlcuwuluu.supabase.co',
  anonKey: 'sb_publishable_LUQaRw1_NypxF7T2zguSoA_iCdKsdRW',
}
