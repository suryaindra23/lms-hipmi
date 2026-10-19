import Image from "next/image";

const team = [
  {
    number: "01",
    name: "Surya Indra Permana",
    credentials: ", S.Kom",
    role: "Chief Executive Officer",
    roleShort: "CEO",
    image: "/images/team/surya-indra-permana.jpg",
    initials: "SI",
  },
  {
    number: "02",
    name: "Hendi Suryo Leksono",
    credentials: ", S.E., M.M.",
    role: "Chief Operating Officer",
    roleShort: "COO",
    image: "/images/team/hendi-suryo-leksono.jpg",
    initials: "HS",
  },
  {
    number: "03",
    name: "Nabila Putri Restaningsih",
    credentials: "",
    role: "Mentor",
    roleShort: "Mentor",
    image: "",
    initials: "NP",
  },
  {
    number: "04",
    name: "Lutfhan Bayu Zulkarnain",
    credentials: "",
    role: "Mentor dan Chief Marketing Officer",
    roleShort: "Mentor · CMO",
    image: "",
    initials: "LB",
  },
  {
    number: "05",
    name: "Ernando Januar Pratama",
    credentials: "",
    role: "Tim IT",
    roleShort: "Tim IT",
    image: "",
    initials: "EJ",
  },
];

export default function Team() {
  return (
    <section id="team" className="border-y border-slate-900/10 bg-[#FFFFFF] py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-700">Struktur tim</p>
            <h2 className="mt-5 max-w-xl text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 sm:text-5xl">
              Orang-orang yang menggerakkan Sunrise Ads Academy.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">
              Tim inti yang menjaga arah program, pengelolaan, dan keberlanjutan pembelajaran digital untuk sekolah.
            </p>
          </div>

          <div className="border-t border-slate-900/15">
            {team.map((member) => (
              <article key={member.name} className="group grid grid-cols-[88px_1fr] items-center gap-5 border-b border-slate-900/15 py-8 sm:grid-cols-[112px_1fr_auto] sm:gap-7 sm:py-10">
                <div className="relative w-[88px] sm:w-28">
                  <span className="absolute -bottom-2 -right-2 h-full w-full rounded-2xl border border-orange-300 bg-orange-100 transition-transform group-hover:translate-x-1 group-hover:translate-y-1" aria-hidden="true" />
                  {member.image ? (
                    <Image
                      src={member.image}
                      alt={`Foto ${member.name}`}
                      width={224}
                      height={280}
                      sizes="(max-width: 640px) 88px, 112px"
                      className="relative aspect-[4/5] w-full rounded-2xl border border-slate-900/15 bg-white object-cover object-top"
                    />
                  ) : (
                    <div aria-label={`Foto ${member.name} belum tersedia`} className="relative grid aspect-[4/5] w-full place-items-center rounded-2xl border border-slate-900/15 bg-slate-950 text-lg font-extrabold tracking-[0.12em] text-orange-300">
                      {member.initials}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-700 sm:hidden">{member.roleShort}</p>
                  <h3 className="mt-2 text-xl font-extrabold tracking-[-0.025em] text-slate-950 sm:mt-0 sm:text-2xl">
                    {member.name}<span className="font-editorial font-normal italic text-slate-500">{member.credentials}</span>
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{member.role}</p>
                </div>
                <div className="hidden items-center gap-4 sm:flex">
                  <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{member.roleShort}</span>
                  <span className="font-editorial text-3xl italic text-orange-700">{member.number}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
