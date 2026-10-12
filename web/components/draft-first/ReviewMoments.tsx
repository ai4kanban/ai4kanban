import { FiCheckCircle, FiTrash2 } from "react-icons/fi";
import { Lockup } from "./Lockup";
import { Chip, DOC, DraftHead, HAIR, Note, SettingsDraft, UI, type Lang } from "./review-parts";

// Section 3's figures: one moment of the review page each, drawn at 400×300.
export const MOMENT_W = 400;
export const MOMENT_H = 300;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-end overflow-hidden bg-nb-paper text-nb-ink" style={{ width: MOMENT_W, height: MOMENT_H }}>
      {children}
    </div>
  );
}

function Option({ lang, children }: { lang: Lang; children?: React.ReactNode }) {
  const doc = DOC[lang];
  return (
    <section className="nb-section mx-3 mb-3 bg-nb-sheet px-3 py-2.5">
      <h2 className="text-[16px] font-[800]">{doc.d1}</h2>
      <div className="mt-1">
        <DraftHead label={doc.a} src="settings-form.tsx" tools ui={UI[lang]} />
        <div style={{ zoom: 0.5 }}>
          <SettingsDraft lang={lang} />
        </div>
        {children}
      </div>
    </section>
  );
}

function DeleteMoment({ lang }: { lang: Lang }) {
  const ui = UI[lang];
  return (
    <Frame>
      <Option lang={lang}>
        <div className="mt-3 flex items-center gap-2 rounded-[9px] bg-nb-wash px-3 py-2 text-[12.5px] text-nb-ink-soft">
          <FiTrash2 className="h-3 w-3" />
          <span className="line-through">{ui.deleted(DOC[lang].b)}</span>
          <span className="ml-auto font-[700] text-nb-accent-deep">{ui.undo}</span>
        </div>
      </Option>
    </Frame>
  );
}

function NoteMoment({ lang }: { lang: Lang }) {
  return (
    <Frame>
      <Option lang={lang}>
        <Note text={DOC[lang].noteA} editing ui={UI[lang]} />
      </Option>
    </Frame>
  );
}

function ConfirmMoment({ lang }: { lang: Lang }) {
  const ui = UI[lang];
  return (
    <Frame>
      <div className={`flex h-11 shrink-0 items-center gap-2.5 border-b ${HAIR} px-4`}>
        <Lockup size={15} />
        <Chip tone="mint">{ui.confirmed}</Chip>
      </div>
      <div className="flex flex-1 flex-col justify-center px-4">
        <div className="nb-section flex gap-3 bg-nb-mint-soft px-4 py-4">
          <FiCheckCircle className="mt-[3px] h-4 w-4 shrink-0 text-nb-mint-ink" />
          <div className="text-[13.5px] leading-[21px]">
            <div className="font-[800] text-nb-mint-ink">{ui.doneTitle}</div>
            <div className="mt-1 text-nb-ink">{ui.doneBody}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-nb-ink-soft">
              {ui.contract}
              <span className="rounded-[6px] bg-nb-paper px-2 py-0.5 font-mono text-nb-ink">.draft-first/ai-commit-message.md</span>
            </div>
          </div>
        </div>
        <h1 className="mt-5 truncate text-[22px] font-[800] tracking-[-0.02em] text-nb-ink-soft">{DOC[lang].title}</h1>
      </div>
    </Frame>
  );
}

export const MOMENTS = [DeleteMoment, NoteMoment, ConfirmMoment];
