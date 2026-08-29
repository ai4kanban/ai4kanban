"use client";

// Configuration → General: the three settings groups that never needed a pane each.
//
// Setup (#174) is two rows — the skill in this project, the `akb` command on the PATH.
// Delivery (#303, #308) is two switches. Language (#334) is one control. Three panes for
// five settings was a sidebar you had to walk to find anything; one pane shows all of it
// at a glance, and each group's caption is the whole of its explanation.
//
// Nothing is drawn here: each group is its own file, beside the state it reads. What makes
// three groups read as three is in components/settings.tsx — a caption on the pane's ground
// and the settings themselves in one card under it.

import { DeliveryGroup } from "./AutoDelivery";
import { LanguageGroup } from "./language";
import { SetupGroup } from "./Skill";

export function GeneralPanel({ onError }: { onError?: (msg: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <SetupGroup onError={onError} />
      <DeliveryGroup onError={onError} />
      <LanguageGroup onError={onError} />
    </div>
  );
}
