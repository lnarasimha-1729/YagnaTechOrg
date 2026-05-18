import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveJoin, getSdkSignature } from './liveClassApi';

/**
 * Course-player Zoom Web SDK room.
 *
 * Renders the Zoom in-browser meeting UI. The SDK signature is generated
 * server-side (backend/admin-service/src/zoom-live-class/zoom.live-class.js)
 * so the SDK secret never leaves the backend.
 */

const ZOOM_VERSION = '3.1.6';
const ZOOM_BASE = `https://source.zoom.us/${ZOOM_VERSION}`;

const loadScript = (src) =>
    new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(s);
    });

const loadZoomSdk = async () => {
    await loadScript(`${ZOOM_BASE}/lib/vendor/react.min.js`);
    await loadScript(`${ZOOM_BASE}/lib/vendor/react-dom.min.js`);
    await loadScript(`${ZOOM_BASE}/lib/vendor/redux.min.js`);
    await loadScript(`${ZOOM_BASE}/lib/vendor/redux-thunk.min.js`);
    await loadScript(`${ZOOM_BASE}/lib/vendor/lodash.min.js`);
    await loadScript(`${ZOOM_BASE}/zoom-meeting-${ZOOM_VERSION}.min.js`);
    return window.ZoomMtg;
};

export default function ZoomLiveClassRoom({ user }) {
    const { id } = useParams();
    const [error, setError] = useState(null);
    const [phase, setPhase] = useState('preparing');
    const startedRef = useRef(false);

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;

        (async () => {
            try {
                setPhase('resolving');
                const join = await resolveJoin(id);
                if (join.mode === 'unavailable') {
                    setError(join.reason || 'Live class is unavailable.');
                    return;
                }
                if (join.mode === 'redirect') {
                    window.location.href = join.url;
                    return;
                }

                setPhase('loading-sdk');
                const ZoomMtg = await loadZoomSdk();

                setPhase('signing');
                const sig = await getSdkSignature(id);

                setPhase('joining');
                ZoomMtg.preLoadWasm();
                ZoomMtg.prepareWebSDK();
                ZoomMtg.i18n.load('en-US');

                ZoomMtg.init({
                    leaveUrl: document.referrer || '/',
                    disableCORP: !window.crossOriginIsolated,
                    success: () => {
                        ZoomMtg.join({
                            meetingNumber: sig.meetingNumber,
                            userName: user?.name || 'Student',
                            signature: sig.signature,
                            sdkKey: sig.sdkKey,
                            userEmail: user?.email,
                            passWord: sig.password,
                            success: () => {
                                ZoomMtg.getAttendeeslist({});
                                setPhase('in-meeting');
                            },
                            error: (e) => setError(e?.errorMessage || 'Failed to join the meeting.'),
                        });
                    },
                    error: (e) => setError(e?.errorMessage || 'Failed to initialise Zoom.'),
                });

                ZoomMtg.inMeetingServiceListener('onUserJoin', (d) => console.log('onUserJoin', d));
                ZoomMtg.inMeetingServiceListener('onUserLeave', (d) => console.log('onUserLeave', d));
                ZoomMtg.inMeetingServiceListener('onUserIsInWaitingRoom', (d) =>
                    console.log('onUserIsInWaitingRoom', d)
                );
                ZoomMtg.inMeetingServiceListener('onMeetingStatus', (d) =>
                    console.log('onMeetingStatus', d)
                );
            } catch (e) {
                setError(e?.response?.data?.error || e?.message || 'Failed to load Zoom.');
            }
        })();
    }, [id, user]);

    if (error) {
        return (
            <div className="player-shell flex flex-col items-center justify-center min-h-screen p-8 text-center">
                <h3 className="text-white text-[18px] font-semibold mb-2">
                    Could not start the live class
                </h3>
                <p className="text-red-300 mb-4">{error}</p>
                <button
                    type="button"
                    className="ol-btn-outline"
                    onClick={() => window.close()}
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="player-shell flex items-center justify-center min-h-screen">
            <div className="text-white/70">
                {phase === 'preparing' && 'Preparing live class…'}
                {phase === 'resolving' && 'Checking class…'}
                {phase === 'loading-sdk' && 'Loading Zoom…'}
                {phase === 'signing' && 'Authorising…'}
                {phase === 'joining' && 'Joining the meeting…'}
                {phase === 'in-meeting' && ''}
            </div>
        </div>
    );
}
