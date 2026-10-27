import { FactoryVerificationPanel } from '../../components/manufacturer/FactoryVerificationPanel';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useRef, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  FileText,
  Upload,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../components/ui/utils';
import {
  loadCompleteManufacturerProfile,
  saveCompleteManufacturerProfile,
} from '../../data/manufacturerOnboardingStore';
import type { FactoryVerificationData } from '../../data/manufacturerOnboardingTypes';

function ManufacturerVerificationPreview() {
  const [profile, setProfile] = useState(() => loadCompleteManufacturerProfile());
  const [verification, setVerification] = useState<FactoryVerificationData>(
    profile.verification || {
      status: 'not_submitted',
      registrationNumber: profile.businessRegNumber || '',
      registeredAddress: '',
      certifications: [],
      documentUrls: [],
    },
  );

  const [registrationNumber, setRegistrationNumber] = useState(
    verification.registrationNumber || profile.businessRegNumber || '',
  );
  const [registeredAddress, setRegisteredAddress] = useState(
    verification.registeredAddress || profile.addressLine || '',
  );
  const [certificationsInput, setCertificationsInput] = useState(
    (verification.certifications || []).join(', '),
  );
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [isReading, setIsReading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const documents = verification.documentUrls || [];
  const locked = verification.status === 'verified' || verification.status === 'pending_review';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddDocuments = async (files: FileList | null) => {
    if (!files?.length || locked || isReading) return;
    const selected = Array.from(files);
    if (selected.some((file) => !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      toast.error('Choose PDF, JPG, PNG or WebP files');
      return;
    }
    if (documents.reduce((size, url) => size + url.length, 0) + selected.reduce((size, file) => size + Math.ceil(file.size * 4 / 3), 0) > 2 * 1024 * 1024) {
      toast.error('Attachments must total less than 2 MB');
      return;
    }
    setIsReading(true);
    try {
      const urls = await Promise.all(selected.map((file) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
      })));
      setVerification((prev) => ({ ...prev, documentUrls: [...(prev.documentUrls || []), ...urls] }));
      toast.success('Documents attached. Submit the package to save them.');
    } catch {
      toast.error('Unable to read attachments. Please try again.');
    } finally {
      setIsReading(false);
    }
  };

  const handleRemoveDoc = (index: number) => {
    setVerification((prev) => ({
      ...prev,
      documentUrls: (prev.documentUrls || []).filter((_, i) => i !== index),
    }));
  };

  const handleSubmitVerification = () => {
    if (locked || isReading || isSubmitting) return;
    if (!registrationNumber.trim()) {
      toast.error('Business registration number is required for verification');
      return;
    }
    if (!registeredAddress.trim()) {
      toast.error('Registered business address is required');
      return;
    }

    if (!documents.length) {
      toast.error('Attach at least one supporting document');
      return;
    }
    setIsSubmitting(true);
    const updatedVerification: FactoryVerificationData = {
      ...verification,
      status: 'pending_review',
      submittedAt: new Date().toISOString(),
      registrationNumber: registrationNumber.trim(),
      registeredAddress: registeredAddress.trim(),
      certifications: certificationsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const nextProfile = {
      ...profile,
      verification: updatedVerification,
    };

    setTimeout(() => {
      setProfile(nextProfile);
      setVerification(updatedVerification);
      saveCompleteManufacturerProfile(nextProfile);
      setIsSubmitting(false);
      toast.success('Verification package submitted for administrative review');
    }, 400);
  };

  // Status Badge UI
  const renderStatusBadge = () => {
    switch (verification.status) {
      case 'verified':
        return (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            <div>
              <div className="text-xs font-semibold">Factory Verified</div>
              <div className="text-[10px] text-emerald-400/80">
                Verified by Ceriga Superadmin on{' '}
                {verification.reviewedAt?.slice(0, 10) || 'Active'}
              </div>
            </div>
          </div>
        );
      case 'pending_review':
        return (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-amber-400">
            <Clock className="h-5 w-5 animate-pulse" />
            <div>
              <div className="text-xs font-semibold">Verification Pending Review</div>
              <div className="text-[10px] text-amber-400/80">
                Submitted on {verification.submittedAt?.slice(0, 10)}. Expected turnaround: 24–48 hours.
              </div>
            </div>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-red-400">
            <ShieldAlert className="h-5 w-5" />
            <div>
              <div className="text-xs font-semibold">Action Required / Re-submission Needed</div>
              <div className="text-[10px] text-red-400/80">
                {verification.rejectionReason || 'Please update registration documentation.'}
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white/60">
            <ShieldAlert className="h-5 w-5 text-white/40" />
            <div>
              <div className="text-xs font-semibold text-white/90">Not Yet Submitted</div>
              <div className="text-[10px] text-white/40">
                Optional verification adds a verified badge to your profile and priority brand matching.
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#CC2D24]">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Compliance & Trust
            </span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Factory Verification
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Submit your legal business registration and factory certifications to earn the Ceriga Verified Factory badge.
          </p>
        </div>

        <div>{renderStatusBadge()}</div>
      </div>

      {/* Main Verification Form */}
      <div className="rounded-2xl border border-[#252528] bg-[#111113] p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#CC2D24]" /> Business Registration & Location
          </h2>
          <p className="text-xs text-white/40 mt-1">
            Official government entities and physical production plants must match these details.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div>
            <Label className="text-white/80">Business Registration Number *</Label>
            <Input
              value={registrationNumber}
              disabled={locked || isSubmitting}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="e.g. US-EIN-94820194 or UK-CRN-098273"
              className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
            />
          </div>

          <div>
            <Label className="text-white/80">Official Registered Address *</Label>
            <Input
              value={registeredAddress}
              disabled={locked || isSubmitting}
              onChange={(e) => setRegisteredAddress(e.target.value)}
              placeholder="Full legal facility address"
              className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
            />
          </div>
        </div>

        <div>
          <Label className="text-white/80">
            Industry Certifications (OEKO-TEX, GOTS, ISO, Sedex, WRAP)
          </Label>
          <Input
            value={certificationsInput}
            disabled={locked || isSubmitting}
            onChange={(e) => setCertificationsInput(e.target.value)}
            placeholder="e.g. OEKO-TEX Standard 100, GOTS Certified, ISO 9001"
            className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
          />
        </div>

        {/* Supporting Documents */}
        <div className="pt-4 border-t border-[#252528] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-white/60" /> Verification Documents
              </h3>
              <p className="text-[11px] text-white/40">
                Attach proof of company incorporation, factory lease, or ISO/audit certifications.
              </p>
            </div>
          </div>

          {!locked && (
            <div>
              <input
                ref={documentInputRef}
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                aria-label="Attach verification documents"
                className="sr-only"
                disabled={isReading || isSubmitting}
                onChange={(event) => {
                  void handleAddDocuments(event.target.files);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={isReading || isSubmitting}
                onClick={() => documentInputRef.current?.click()}
                onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (!isSubmitting) void handleAddDocuments(event.dataTransfer.files);
                }}
                className={cn('flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-xs text-white/70 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC2D24] disabled:opacity-50', isDragging ? 'border-[#CC2D24] bg-[#CC2D24]/10' : 'border-white/15')}
              >
                <Upload className="h-6 w-6 text-white/40" />
                <span>{isReading ? 'Reading documents…' : 'Drag and drop documents or click to browse'}</span>
                <span className="text-[11px] text-white/40">PDF, JPG, PNG or WebP · 2 MB total</span>
              </button>
            </div>
          )}

          {/* Documents List */}
          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#252528] p-4 text-center text-xs text-white/40">
              No documents attached yet.
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((url, index) => (
                <div
                  key={`${index}-${url.slice(0, 40)}`}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-[#CC2D24]" />
                    <div>
                      <a href={url} download={`verification-document-${index + 1}`} className="font-medium text-white hover:underline">
                        Supporting document {index + 1} <ExternalLink className="inline h-3 w-3" />
                      </a>
                      <div className="text-[10px] text-white/40">Attached to verification package</div>
                    </div>
                  </div>

                  {!locked && (
                    <button
                      type="button"
                      disabled={isReading || isSubmitting}
                      onClick={() => handleRemoveDoc(index)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Action */}
        {!locked && (
          <div className="pt-4 border-t border-[#252528] flex justify-end">
            <Button
              onClick={handleSubmitVerification}
              disabled={isSubmitting || isReading}
              className="bg-[#CC2D24] text-white hover:bg-[#CC2D24]/90 px-6 font-semibold text-xs"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Verification Package'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ManufacturerVerification(){return isSupabaseConfigured ? <FactoryVerificationPanel/> : <ManufacturerVerificationPreview/>;}
