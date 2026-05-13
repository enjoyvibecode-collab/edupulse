-- EDU PULSE SMART ATTENDANCE DATABASE SCHEMA

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('platform_owner', 'admin_sekolah', 'guru', 'orang_tua')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nisn TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create attendance_logs table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('arrival', 'departure')),
  confidence FLOAT NOT NULL,
  captured_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Profiles: Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Profiles: Platform owners can do everything
CREATE POLICY "Platform owners have full access to profiles"
ON public.profiles FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_owner'
));

-- Students: Authenticated users can view students
CREATE POLICY "Authenticated users can view students"
ON public.students FOR SELECT
TO authenticated
USING (true);

-- Students: Admins can modify students
CREATE POLICY "Admins can modify students"
ON public.students FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('platform_owner', 'admin_sekolah')
));

-- Attendance: Authenticated users can view logs
CREATE POLICY "Authenticated users can view attendance logs"
ON public.attendance_logs FOR SELECT
TO authenticated
USING (true);

-- Attendance: Admins and Gurus can manage logs
CREATE POLICY "Admins and Gurus can manage logs"
ON public.attendance_logs FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('platform_owner', 'admin_sekolah', 'guru')
));

-- PROFILE TRIGGER ON AUTH SIGNUP
-- Automatically create a profile when a new user signs up (Default to 'guru' or 'orang_tua')
-- Note: In production, you'd handle admin creation separately or via invite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'guru');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
