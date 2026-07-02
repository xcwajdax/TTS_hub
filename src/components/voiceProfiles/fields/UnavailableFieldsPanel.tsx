import type { TtsProvider } from "../../../types";

import { visibleCapabilityFields } from "../../../lib/voiceProfileProviderCapabilities";

import ProfileFieldShell from "./ProfileFieldShell";

import VpFormItem from "../VpFormItem";



interface Props {

  provider: TtsProvider;

  advancedMode: boolean;

}



export default function UnavailableFieldsPanel({ provider, advancedMode }: Props) {

  const fields = visibleCapabilityFields(provider, advancedMode);

  if (fields.length === 0) return null;



  return (

    <section className="vp-panel vp-form__item vp-form__item--full">

      <h3 className="text-xs font-medium text-muted mb-2">

        Opcje providera — niedostępne lub w roadmapie

      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

        {fields.map((f) => (

          <VpFormItem key={f.key}>

            <ProfileFieldShell

              label={f.label}

              tooltip={f.tooltip}

              defaultHint={f.defaultHint}

              availability={f.availability}

              disabledReason={f.disabledReason}

              voiceProfileUi

            >

              <input className="vp-field" disabled placeholder="—" />

            </ProfileFieldShell>

          </VpFormItem>

        ))}

      </div>

    </section>

  );

}

