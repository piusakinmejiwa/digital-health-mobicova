import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CallScreen, { type CallProvider } from '../../components/member/CallScreen';
import VideoCall from '../../components/member/VideoCall';
import PrescriptionTracker from '../../components/member/PrescriptionTracker';
import {
  logMemberConsultation, completeConsultation, startConsultation, startPhoneCall,
  getMemberDoctors, getMemberOverview,
} from '../../api/member';
import './Member.css';
import './Call.css';

const initials = (n: string) => n.replace(/^Dr\.?\s*/i, '').split(' ').map((w) => w[0]).slice(0, 2).join('');

export default function MemberCarePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['member-doctors'], queryFn: getMemberDoctors });
  const doctors = data?.doctors ?? [];
  const { data: overview } = useQuery({ queryKey: ['member-overview'], queryFn: getMemberOverview });
  const prescriptions = overview?.prescriptions ?? [];
  const phoneCallsEnabled = overview?.capabilities?.phoneCalls ?? false;
  const recordingEnabled = overview?.capabilities?.recording ?? false;
  // Status card for an in-flight masked phone call (the call happens on the
  // member's actual phone line, so there's no in-browser call UI).
  const [phoneCall, setPhoneCall] = useState<{ doctorName: string; maskedNumber: string; error?: string } | null>(null);
  // Demo call screen (voice, and the video fallback when Daily isn't configured).
  // `consultId` is set when the call already has a consultation row to close out.
  const [call, setCall] = useState<{ mode: 'video' | 'voice'; provider: CallProvider; consultId?: string } | null>(null);
  // Real Daily call (member + doctor join the same room). Voice = camera-off variant.
  const [videoCall, setVideoCall] = useState<{ id: string; mode: 'video' | 'voice'; roomUrl: string; token: string; provider: CallProvider; recording: boolean } | null>(null);
  // Recording-consent prompt shown before a video call when recording is enabled.
  const [consentFor, setConsentFor] = useState<CallProvider | null>(null);

  const refreshCare = () => {
    qc.invalidateQueries({ queryKey: ['member-overview'] });
    qc.invalidateQueries({ queryKey: ['member-me'] });
  };

  // Start a live consultation (video or voice): create the consult (so the doctor
  // sees it), then open the real Daily room. Voice joins the same room camera-off.
  // If Daily isn't configured server-side, fall back to the demo screen but still
  // close out the consult on end.
  const startCall = async (mode: 'video' | 'voice', provider: CallProvider, recordingConsent = false) => {
    setConsentFor(null);
    try {
      const r = await startConsultation({ mode, doctorName: provider.name, recordingConsent });
      if (r.video) {
        setVideoCall({ id: r.consultation.id, mode, roomUrl: r.video.roomUrl, token: r.video.token, provider, recording: r.recording });
      } else {
        setCall({ mode, provider, consultId: r.consultation.id });
      }
    } catch {
      // Couldn't reach the start endpoint — use the self-contained demo screen.
      setCall({ mode, provider });
    }
  };

  // Video tap: ask for recording consent first if recording is enabled, else start.
  const onVideoTap = (provider: CallProvider) => {
    if (recordingEnabled) setConsentFor(provider);
    else startCall('video', provider, false);
  };

  // Place a real masked phone call: the member's phone rings, then bridges to
  // the doctor. We show a status card; the actual call is on the phone line.
  const callPhone = async (provider: CallProvider) => {
    setPhoneCall({ doctorName: provider.name, maskedNumber: '' });
    try {
      const r = await startPhoneCall(provider.name);
      setPhoneCall({ doctorName: r.doctorName, maskedNumber: r.maskedNumber });
      refreshCare();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Could not place the call. Please try again.';
      setPhoneCall({ doctorName: provider.name, maskedNumber: '', error: msg });
    }
  };

  // When a call ends, log/close it as a consultation (shows in Recent care + the partner dashboard).
  const endCall = (seconds: number) => {
    if (call) {
      const done = call.consultId
        ? completeConsultation(call.consultId, seconds)
        : logMemberConsultation({ mode: call.mode, doctorName: call.provider.name, durationSeconds: seconds });
      done.then(refreshCare).catch(() => { /* best-effort; don't block the UI */ });
    }
    setCall(null);
  };

  const endVideo = (seconds: number) => {
    if (videoCall) completeConsultation(videoCall.id, seconds).then(refreshCare).catch(() => {});
    setVideoCall(null);
  };

  return (
    <div className="m-screen">
      <header className="m-head-plain"><h1>Care</h1></header>
      <div className="m-body">
        {/* Talk to a doctor now — live video / voice */}
        <div className="m-sec-h">Talk to a doctor now</div>
        {doctors.map((d) => {
          const provider: CallProvider = { name: d.full_name, role: d.specialty || 'Doctor', photo: d.photo_url || undefined };
          return (
            <div key={d.id} className="m-doc">
              <div className="m-doc-top">
                {d.photo_url
                  ? <img className="m-doc-av" src={d.photo_url} alt={d.full_name} />
                  : <div className="m-doc-av m-doc-av-ph">{initials(d.full_name)}</div>}
                <div className="m-doc-info">
                  <b>{d.full_name}</b>
                  <small>{d.specialty || 'General Practice'}</small>
                  <span className="m-doc-status on">● Available now</span>
                </div>
              </div>
              <div className="m-doc-actions">
                <button className="m-doc-btn video" onClick={() => onVideoTap(provider)}>📹 Video call</button>
                <button className="m-doc-btn voice" onClick={() => startCall('voice', provider)}>📞 Voice call</button>
                {phoneCallsEnabled && (
                  <button className="m-doc-btn voice" onClick={() => callPhone(provider)}>📱 Call my phone</button>
                )}
              </div>
            </div>
          );
        })}
        {doctors.length === 0 && <p className="m-muted">No doctors are available right now — please check back shortly.</p>}
        <p className="m-muted">Connect instantly with a licensed doctor — consultations are delivered through MobiCova’s provider partners.</p>

        {/* Your prescriptions — choose pickup/delivery and track fulfilment */}
        {prescriptions.length > 0 && (
          <>
            <div className="m-sec-h">Your prescriptions</div>
            {prescriptions.map((rx) => (
              <PrescriptionTracker
                key={rx.id}
                rx={rx}
                onUpdated={() => qc.invalidateQueries({ queryKey: ['member-overview'] })}
              />
            ))}
          </>
        )}

        {/* AI symptom check */}
        <div className="m-sec-h">Not sure? Check a symptom first</div>
        <div className="m-act-wide" onClick={() => navigate('/member/care/symptom-check')}>
          <div className="m-ai amber">✦</div>
          <div>
            <div className="m-al">AI symptom check</div>
            <div className="m-as">Free guidance in seconds — not a diagnosis</div>
          </div>
        </div>
      </div>

      {call && (
        <CallScreen mode={call.mode} provider={call.provider} onEnd={endCall} />
      )}
      {videoCall && (
        <VideoCall
          roomUrl={videoCall.roomUrl}
          token={videoCall.token}
          title={videoCall.provider.name}
          subtitle={videoCall.mode === 'voice'
            ? 'Voice consultation · MobiCova Telemedicine'
            : `${videoCall.provider.role} · MobiCova Telemedicine`}
          recording={videoCall.recording}
          onEnd={endVideo}
        />
      )}

      {consentFor && (
        <div className="m-phonecall-backdrop" onClick={() => setConsentFor(null)}>
          <div className="m-phonecall" onClick={(e) => e.stopPropagation()}>
            <div className="m-phonecall-ico" style={{ animation: 'none' }}>🔴</div>
            <h3>Record this consultation?</h3>
            <p className="m-muted">
              For your medical records and quality assurance, this video consultation with <strong>{consentFor.name}</strong> can
              be recorded. Both you and the doctor will be notified during the call. See our <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
            </p>
            <button className="m-doc-btn video" onClick={() => startCall('video', consentFor, true)}>Agree &amp; start recorded call</button>
            <button className="m-doc-btn voice" style={{ marginTop: 8 }} onClick={() => startCall('video', consentFor, false)}>Start without recording</button>
          </div>
        </div>
      )}

      {phoneCall && (
        <div className="m-phonecall-backdrop" onClick={() => setPhoneCall(null)}>
          <div className="m-phonecall" onClick={(e) => e.stopPropagation()}>
            {phoneCall.error ? (
              <>
                <div className="m-phonecall-ico err">⚠️</div>
                <h3>Couldn’t place the call</h3>
                <p className="m-muted">{phoneCall.error}</p>
              </>
            ) : (
              <>
                <div className="m-phonecall-ico">📲</div>
                <h3>Calling your phone…</h3>
                <p className="m-muted">
                  We’re ringing your phone now to connect you with <strong>{phoneCall.doctorName}</strong>.
                  Please answer to start the consultation.
                </p>
                {phoneCall.maskedNumber && (
                  <p className="m-phonecall-num">The call shows as <strong>{phoneCall.maskedNumber}</strong></p>
                )}
              </>
            )}
            <button className="m-doc-btn voice" onClick={() => setPhoneCall(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
