import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export async function GET() {
  const { error } = await requireAdmin('admins.view')
  if (error) return NextResponse.json({error},{status:error==='Unauthorized'?401:403})
  try {
    const supabase=serviceClient()
    const [{data:roles,error:re},{data:permissions,error:pe},{data:users,error:ue}]=await Promise.all([
      supabase.from('admin_roles').select('id,user_id,role,is_active,created_at,updated_at'),
      supabase.from('admin_permissions').select('id,code,name_uz').order('name_uz'),
      supabase.auth.admin.listUsers({page:1,perPage:1000})
    ])
    if(re) throw re; if(pe) throw pe; if(ue) throw ue
    const {data:links,error:le}=await supabase.from('admin_role_permissions').select('role_id,permission_id'); if(le) throw le
    const admins=(roles??[]).map(r=>({...r,email:users?.users.find(u=>u.id===r.user_id)?.email??'',permissions:(links??[]).filter(l=>l.role_id===r.id).map(l=>l.permission_id)}))
    return NextResponse.json({admins,permissions:permissions??[]})
  } catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Adminlar yuklanmadi'},{status:500})}
}

export async function POST(request:NextRequest){
 const {admin,error}=await requireAdmin('admins.manage'); if(error||!admin)return NextResponse.json({error},{status:error==='Unauthorized'?401:403})
 try{
  const body=await request.json(); const email=typeof body.email==='string'?body.email.trim().toLowerCase():''; const password=typeof body.password==='string'?body.password:''; const permissionCodes=Array.isArray(body.permissionCodes)?body.permissionCodes.filter((x:any)=>typeof x==='string'):[]
  if(!email||!password||password.length<8)return NextResponse.json({error:'Email va kamida 8 belgili parol kerak.'},{status:400})
  const supabase=serviceClient(); const {data:userData,error:userError}=await supabase.auth.admin.createUser({email,password,email_confirm:true}); if(userError) throw userError; if(!userData.user)throw new Error('Admin user yaratilmadi')
  const {data:roleData,error:roleError}=await supabase.from('admin_roles').insert({user_id:userData.user.id,role:'admin',is_active:true}).select('id').single(); if(roleError)throw roleError
  if(permissionCodes.length){const {data:perms,error:permError}=await supabase.from('admin_permissions').select('id,code').in('code',permissionCodes);if(permError)throw permError;const rows=(perms??[]).map(p=>({role_id:roleData.id,permission_id:p.id}));if(rows.length){const {error:linkError}=await supabase.from('admin_role_permissions').insert(rows);if(linkError)throw linkError}}
  return NextResponse.json({ok:true,user:{id:userData.user.id,email:userData.user.email}})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Admin yaratilmadi'},{status:500})}
}

export async function PATCH(request:NextRequest){
 const {admin,error}=await requireAdmin('admins.manage'); if(error||!admin)return NextResponse.json({error},{status:error==='Unauthorized'?401:403})
 try{const body=await request.json();const roleId=typeof body.roleId==='string'?body.roleId:'';if(!roleId)return NextResponse.json({error:'Admin ko‘rsatilmagan.'},{status:400});const supabase=serviceClient();const {data,error:targetError}=await supabase.from('admin_roles').select('id,user_id,role').eq('id',roleId).single();if(targetError||!data)throw targetError||new Error('Admin topilmadi');if(data.role==='super_admin')return NextResponse.json({error:'Bosh adminni bu yerdan o‘zgartirib bo‘lmaydi.'},{status:400});if(data.user_id===admin.user.id)return NextResponse.json({error:'O‘zingizni bloklay olmaysiz.'},{status:400});if(typeof body.isActive==='boolean'){const {error:e}=await supabase.from('admin_roles').update({is_active:body.isActive,updated_at:new Date().toISOString()}).eq('id',roleId);if(e)throw e}if(Array.isArray(body.permissionCodes)){const {data:perms,error:e}=await supabase.from('admin_permissions').select('id,code').in('code',body.permissionCodes.filter((x:any)=>typeof x==='string'));if(e)throw e;await supabase.from('admin_role_permissions').delete().eq('role_id',roleId);if((perms??[]).length){const {error:le}=await supabase.from('admin_role_permissions').insert((perms??[]).map(p=>({role_id:roleId,permission_id:p.id})));if(le)throw le}}return NextResponse.json({ok:true})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Admin yangilanmadi'},{status:500})}
}
