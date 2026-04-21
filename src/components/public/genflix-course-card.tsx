import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { CourseCoverMedia } from '@/components/public/course-cover-media'
import type { GenflixCourseItem } from '@/features/public/genflix-site-content'

export function GenflixCourseCard({
  course,
}: {
  course: GenflixCourseItem
}) {
  return (
    <article className="group overflow-hidden rounded-[4px] border border-[#D8E6EB] bg-[#F2F8FA] shadow-[0_20px_50px_rgba(10,54,64,0.08)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_28px_64px_rgba(10,54,64,0.12)]">
      <div className="relative aspect-[16/9] overflow-hidden">
        <CourseCoverMedia
          src={course.image}
          alt={course.title}
          title={course.title}
          category={course.category}
          initials={course.initials}
          imageClassName="transition-transform duration-500 group-hover:scale-[1.03]"
          placeholderClassName="transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,54,64,0.04)_0%,rgba(10,54,64,0)_38%,rgba(10,54,64,0.24)_100%)]" />
        <div className="absolute left-4 top-4 rounded-[2px] bg-[#EBF3F5]/92 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#15323B]">
          {course.category}
        </div>
      </div>

      <div className="border-b-[4px] border-[#1C7082] px-4 py-5">
        <div className="flex items-start gap-4">
          <h3 className="flex-1 text-[18px] font-semibold leading-[1.35] tracking-[-0.02em] text-[#15323B]">
            {course.title}
          </h3>
          <Link
            to={`/cursos/${course.slug}`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#19B7DA_0%,#0A3640_100%)] text-white shadow-[0_8px_20px_rgba(10,54,64,0.18)] transition-transform duration-200 group-hover:translate-x-0.5"
            aria-label={`Abrir ${course.title}`}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 border-t border-[#D8E6EB] pt-4">
          <div className="flex items-center gap-3">
            {course.mentorImage ? (
              <img
                src={course.mentorImage}
                alt={course.mentor}
                loading="lazy"
                className="h-[46px] w-[46px] rounded-full object-cover ring-1 ring-[#D8E6EB]"
              />
            ) : (
              <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#D9F0F5] text-sm font-extrabold text-[#0A3640]">
                {course.initials}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-5 text-[#15323B]">{course.mentor}</p>
              <p className="text-[11px] leading-[1.45] text-[#60737A]">{course.role}</p>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
