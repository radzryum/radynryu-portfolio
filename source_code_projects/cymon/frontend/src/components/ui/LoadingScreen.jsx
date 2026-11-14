// Full-screen branded loader — a spinning ring around the CyMon logo. Used for
// the auth check and while signing in on slow connections.
function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-[#efeaf7] dark:bg-slate-950 text-purple-700 dark:text-purple-300 transition-colors">
      <style>{`
        .loader-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          height: 96px;
          width: 96px;
          animation: rotate_3922 1.2s linear infinite;
          background-color: #9b59b6;
          background-image: linear-gradient(#9b59b6, #84cdfa, #5ad1cd);
        }

        .loader-container span {
          position: absolute;
          border-radius: 50%;
          height: 100%;
          width: 100%;
          top: 0;
          left: 0;
          background-color: #9b59b6;
          background-image: linear-gradient(#9b59b6, #84cdfa, #5ad1cd);
        }

        .loader-container span:nth-of-type(1) { filter: blur(5px); }
        .loader-container span:nth-of-type(2) { filter: blur(10px); }
        .loader-container span:nth-of-type(3) { filter: blur(25px); }
        .loader-container span:nth-of-type(4) { filter: blur(50px); }

        .loader-container::after {
          content: "";
          position: absolute;
          top: 10px;
          left: 10px;
          right: 10px;
          bottom: 10px;
          background-color: #fff;
          border: solid 5px #ffffff;
          border-radius: 50%;
        }

        @keyframes rotate_3922 {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }
      `}</style>

      <div className="relative h-[96px] w-[96px] z-10">
        <div className="loader-container">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <img
          src="/logo-cymon.png"
          alt="CyMon"
          className="absolute inset-0 m-auto h-[55px] w-[55px] rounded-full object-contain shadow-sm z-20"
        />
      </div>
      <div className="text-sm font-medium tracking-wide text-purple-700/80 z-20">{label}</div>
    </div>
  )
}

export default LoadingScreen
