import babylonLogo from '../assets/babylon.png'
import spinnerLogo from '../assets/spinner.png'
export function DefaultBabylonPreloader() {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#2A2342', display: 'grid', placeItems: 'center', zIndex: 10001 }}>
        <div style={{ position: 'absolute', right: '18px', bottom: '12px', fontFamily: 'Arial', fontSize: '12px', color: 'white', opacity: 0.9, letterSpacing: '0.3px' }}>
          Downloading ...
        </div>
        <img
          src={babylonLogo}
          alt="Babylon loading logo"
          style={{ position: 'absolute', width: '150px' }}
        />
      </div>
    </>
  );
}
export { babylonLogo, spinnerLogo };
