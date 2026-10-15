import { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  FileText,
  Upload,
  CheckCircle2,
  Building2,
  ExternalLink,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { cn } from '../../components/ui/utils';
import {
  loadCompleteManufacturerProfile,
  saveCompleteManufacturerProfile,
} from '../../data/manufacturerOnboardingStore';
import type { FactoryVerification } from '../../data/manufacturerOnboardingTypes';

export function ManufacturerVerification() {
  const [profile, setProfile] = useState(() => loadCompleteManufacturerProfile());
  const [verification, setVerification] = useState<FactoryVerification>(
    profile.verification || {
      status: 'not_submitted',
      registrationNumber: profile.factoryProfile.registrationNumber || '',
      registeredAddress: '',
      certifications: [],
      documents: [],
    },
  );

  const [registrationNumber, setRegistrationNumber] = useState(
    verification.registrationNumber || '',
  );
  const [registeredAddress, setRegisteredAddress] = useState(
    verification.registeredAddress || '',
  );
  const [certificationsInput, setCertificationsInput] = useState(
    verification.certifications.join(', '),
  );
  const [notes, setNotes] = useState(verification.adminNotes || '');
  const [documentName, setDocumentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddDocument = () => {
    if (!documentName.trim()) {
      toast.error('Document title is required');
      return;
    }
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: documentName.trim(),
      fileUrl: '#',
      uploadedAt: new Date().toISOString().slice(0, 10),
      status: 'pending' as const,
    };
    setVerification((prev) => ({
      ...prev,
      documents: [...prev.documents, newDoc],
    }));
    setDocumentName('');
    toast.success('Document uploaded for inspection');
  };

  const handleRemoveDoc = (id: string) => {
    setVerification((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== id),
    }));
  };

  const handleSubmitVerification = () => {
    if (!registrationNumber.trim()) {
      toast.error('Business registration number is required for verification');
      return;
    }
    if (!registeredAddress.trim()) {
      toast.error('Registered business address is required');
      return;
    }

    setIsSubmitting(true);
    const updatedVerification: FactoryVerification = {
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
      case 'requires_changes':
        return (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-red-400">
            <ShieldAlert className="h-5 w-5" />
            <div>
              <div className="text-xs font-semibold">Action Required / Re-submission Needed</div>
              <div className="text-[10px] text-red-400/80">
                {verification.adminNotes || 'Please update registration documentation.'}
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
              disabled={verification.status === 'verified'}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="e.g. US-EIN-94820194 or UK-CRN-098273"
              className="mt-1 text-xs border-white/10 bg-white/[0.03] text-white"
            />
          </div>

          <div>
            <Label className="text-white/80">Official Registered Address *</Label>
            <Input
              value={registeredAddress}
              disabled={verification.status === 'verified'}
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
            disabled={verification.status === 'verified'}
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

          {/* Upload Mock Input */}
          {verification.status !== 'verified' && (
            <div className="flex gap-2">
              <Input
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="e.g. Business Registration Certificate.pdf"
                className="text-xs border-white/10 bg-white/[0.03] text-white flex-1"
              />
              <Button
                type="button"
                onClick={handleAddDocument}
                variant="outline"
                className="border-white/15 text-xs text-white hover:bg-white/5"
              >
                <Upload className="h-3.5 w-3.5 mr-1" /> Attach
              </Button>
            </div>
          )}

          {/* Documents List */}
          {verification.documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#252528] p-4 text-center text-xs text-white/40">
              No documents attached yet.
            </div>
          ) : (
            <div className="space-y-2">
              {verification.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-[#CC2D24]" />
                    <div>
                      <div className="font-medium text-white">{doc.title}</div>
                      <div className="text-[10px] text-white/40">Uploaded on {doc.uploadedAt}</div>
                    </div>
                  </div>

                  {verification.status !== 'verified' && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(doc.id)}
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
        {verification.status !== 'verified' && (
          <div className="pt-4 border-t border-[#252528] flex justify-end">
            <Button
              onClick={handleSubmitVerification}
              disabled={isSubmitting}
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
