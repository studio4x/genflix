import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { GenflixCourseItem } from '@/features/public/genflix-site-content'

export function GenflixCourseCard({
  course,
}: {
  course: GenflixCourseItem
}) {
  return (
    <article className="group overflow-hidden rounded-[22px] border border-[#D8E6EB] bg-white shadow-[0_20px_50px_rgba(19,152,183,0.08)] transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_60px_rgba(19,152,183,0.16)]">
      <div className="relative aspect-[16/9] overflow-hidden">
        <img
          src={course.image}
          alt={course.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-[11px] font-bold text-[#0A3640] shadow-sm">
          {course.category}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="max-w-[15rem] text-lg font-bold leading-tight text-[#183139]">{course.title}</h3>
          <Link
            to={`/cursos/${course.slug}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#BEE3EA] text-[#1398B7] transition-colors hover:border-[#1398B7] hover:bg-[#F2F7F9]"
            aria-label={`Abrir ${course.title}`}
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex items-center gap-3 border-t border-[#D8E6EB] pt-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D9F0F5] text-sm font-extrabold text-[#0A3640]">
            {course.initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#183139]">{course.mentor}</p>
            <p className="text-xs text-[#6f8187]">{course.role}</p>
          </div>
        </div>
      </div>
    </article>
  )
}
