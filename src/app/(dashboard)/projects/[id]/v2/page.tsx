import { redirect } from 'next/navigation'

// V2가 default가 됨. 옛 북마크 호환을 위해 /projects/[id]로 redirect.
export default async function V2RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/projects/${id}`)
}
