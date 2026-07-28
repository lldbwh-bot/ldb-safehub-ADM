import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type { DashboardMetricModel, RepairFrequencyRankItem } from '../../dashboardMetrics';

interface RepairFrequencyReportProps {
  report: DashboardMetricModel['repairFrequency'];
}

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function safeLabel(value: string): string {
  return value.trim() || '—';
}

function safeNumber(value: number): string {
  return numberFormat.format(Number.isFinite(value) ? value : 0);
}

function RankingTable({
  title,
  items,
  onSelect,
  triggerRef,
}: {
  title: string;
  items: RepairFrequencyRankItem[];
  onSelect: (item: RepairFrequencyRankItem) => void;
  triggerRef: MutableRefObject<HTMLButtonElement | null>;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#08182b]/95 p-4 shadow-[0_18px_45px_rgba(2,8,23,0.24)]">
      <h3 className="text-sm font-black tracking-wide text-white">{title}</h3>
        <div className="mt-4 w-full">
          <table data-repair-ranking-table className="w-full table-fixed text-left text-xs">
            <thead className="bg-cyan-300/5 text-[10px] uppercase tracking-wider text-cyan-100">
              <tr>
                <th className="w-[6%] p-2">#</th>
                <th className="w-[38%] p-2">ລາຍການ</th>
                <th className="w-[14%] p-2 text-center leading-4">ກວດເຊັກ-ສ້ອມ</th>
                <th className="w-[14%] p-2 text-center leading-4">ປ່ຽນອະໄຫຼ່</th>
                <th className="w-[14%] p-2 text-center leading-4">ບໍລິການ</th>
                <th className="w-[14%] p-2 text-center">ລວມ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-300/10 text-slate-200">
              {items.map((item, index) => (
                <tr key={item.name} className="transition hover:bg-cyan-300/5">
                  <td className="p-2 font-mono text-cyan-200">{index + 1}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        triggerRef.current = event.currentTarget;
                        onSelect(item);
                      }}
                      className="w-full break-words rounded-lg px-1 py-1 text-left font-bold text-white transition hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                    >
                      {safeLabel(item.name)}
                    </button>
                  </td>
                  <td className="p-2 text-center">{safeNumber(item.inspectRepair)}</td>
                  <td className="p-2 text-center">{safeNumber(item.replacePart)}</td>
                  <td className="p-2 text-center">{safeNumber(item.service)}</td>
                  <td className="p-2 text-center font-black text-cyan-200">{safeNumber(item.total)}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={6} className="h-28 p-4 text-center text-sm text-slate-400">
                    ຍັງບໍ່ມີລາຍການສ້ອມໃນຂອບເຂດທີ່ເລືອກ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
    </article>
  );
}

export default function RepairFrequencyReport({ report }: RepairFrequencyReportProps) {
  const [selected, setSelected] = useState<RepairFrequencyRankItem | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTriggerRef = useRef<HTMLButtonElement>(null);

  const closeDialog = () => setSelected(null);

  useEffect(() => {
    if (!selected) return;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDialog();
        return;
      }
      const isTabKey = event.key === 'Tab';
      if (!isTabKey) return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = (Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )) as HTMLElement[]).filter(element => element.tabIndex >= 0);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => dialogTriggerRef.current?.focus());
    };
  }, [selected]);

  useEffect(() => {
    if (!selected || typeof document === 'undefined') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const backgroundElements = (Array.from(document.body.children) as HTMLElement[])
      .filter(element => !element.contains(dialog));
    const previousAttributes = backgroundElements.map(element => ({
      element,
      inert: element.hasAttribute('inert'),
      ariaHidden: element.getAttribute('aria-hidden'),
    }));

    for (const element of backgroundElements) {
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    }

    return () => {
      for (const { element, inert, ariaHidden } of previousAttributes) {
        if (!inert) element.removeAttribute('inert');
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }
    };
  }, [selected]);

  return (
    <section id="repair-frequency-report" className="rounded-2xl border border-cyan-300/15 bg-slate-950/35 p-4 sm:p-5">
      <header className="mb-4 border-b border-cyan-300/10 pb-3">
        <h2 className="text-base font-black tracking-wide text-white">ລາຍງານລາຍການສ້ອມທີ່ພົບຫຼາຍສຸດ</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">ເລືອກລາຍການເພື່ອເບິ່ງລາຍລະອຽດກໍລະນີສ້ອມ.</p>
      </header>

      <div className="grid grid-cols-1 gap-5">
        <RankingTable title="ໝວດຍ່ອຍສ້ອມ" items={report.subcategories} onSelect={setSelected} triggerRef={dialogTriggerRef} />
        <RankingTable title="ລາຍການສ້ອມຍ່ອຍ" items={report.subItems} onSelect={setSelected} triggerRef={dialogTriggerRef} />
        <RankingTable title="ອະໄຫຼ່/ຄ່າບໍລິການ" items={report.spareParts} onSelect={setSelected} triggerRef={dialogTriggerRef} />
      </div>

      {selected && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="repair-frequency-detail-title"
            tabIndex={-1}
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-cyan-300/25 bg-slate-900 p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">Repair case details</p>
                <h3 id="repair-frequency-detail-title" className="mt-1 break-words text-xl font-black text-white">{safeLabel(selected.name)}</h3>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close repair case details"
                onClick={closeDialog}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-xl text-slate-300 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {selected.cases.map((repairCase, index) => (
                <article key={`${repairCase.key}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      ['Assessment ID', safeLabel(repairCase.assessmentId)],
                      ['Incident ID/PID', safeLabel(repairCase.incidentId)],
                      ['Branch', safeLabel(repairCase.branch)],
                      ['Category', safeLabel(repairCase.repairSubCategory)],
                      ['Sub-item', safeLabel(repairCase.repairSubItem)],
                      ['Spare part/service', safeLabel(repairCase.sparePart)],
                      ['Work type', safeLabel(repairCase.workType)],
                      ['Quantity', safeNumber(repairCase.quantity)],
                      ['Estimated total cost', safeNumber(repairCase.estimatedTotalCost)],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
                        <p className="mt-1 break-words font-semibold text-slate-100">{value}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
