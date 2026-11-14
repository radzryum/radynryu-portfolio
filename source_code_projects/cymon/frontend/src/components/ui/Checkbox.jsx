import { useId } from 'react'

function Checkbox({ label, className = '', id, ...rest }) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className={`cymon-cb-wrapper inline-flex items-center gap-2.5 ${className}`}>
      <style>{`
        .cymon-cb-wrapper * {
          -webkit-tap-highlight-color: transparent;
          outline: none;
        }
        .cymon-cb-wrapper input[type="checkbox"] {
          display: none;
        }
        .cymon-cb-label {
          --size: 24px;
          --shadow: calc(var(--size) * .07) calc(var(--size) * .1);
          position: relative;
          display: block;
          width: var(--size);
          height: var(--size);
          margin: 0;
          background-color: #6b21a8;
          background-image: linear-gradient(43deg, #6b21a8 0%, #9333ea 46%, #c084fc 100%);
          border-radius: 50%;
          box-shadow: 0 var(--shadow) #f3e8ff;
          cursor: pointer;
          transition: 0.2s ease transform, 0.2s ease background-color, 0.2s ease box-shadow;
          overflow: hidden;
          z-index: 1;
          flex-shrink: 0;
        }
        .cymon-cb-label:before {
          content: "";
          position: absolute;
          top: 50%;
          right: 0;
          left: 0;
          width: calc(var(--size) * .7);
          height: calc(var(--size) * .7);
          margin: 0 auto;
          background-color: #fff;
          transform: translateY(-50%);
          border-radius: 50%;
          box-shadow: inset 0 var(--shadow) #f3e8ff;
          transition: 0.2s ease width, 0.2s ease height;
        }
        .cymon-cb-label:hover:before {
          width: calc(var(--size) * .55);
          height: calc(var(--size) * .55);
          box-shadow: inset 0 var(--shadow) #e9d5ff;
        }
        .cymon-cb-label:active {
          transform: scale(0.9);
        }
        .cymon-cb-tick {
          position: absolute;
          top: -1px;
          right: 0;
          left: calc(var(--size) * -.05);
          width: calc(var(--size) * .6);
          height: calc(var(--size) * .6);
          margin: 0 auto;
          margin-left: calc(var(--size) * .14);
          transform: rotateZ(-40deg);
        }
        .cymon-cb-tick:before,
        .cymon-cb-tick:after {
          content: "";
          position: absolute;
          background-color: #fff;
          border-radius: 2px;
          opacity: 0;
          transition: 0.2s ease transform, 0.2s ease opacity;
        }
        .cymon-cb-tick:before {
          left: 0;
          bottom: 0;
          width: calc(var(--size) * .1);
          height: calc(var(--size) * .3);
          box-shadow: -1px 0 2px rgba(0, 0, 0, 0.23);
          transform: translateY(calc(var(--size) * -.68));
        }
        .cymon-cb-tick:after {
          left: 0;
          bottom: 0;
          width: 100%;
          height: calc(var(--size) * .1);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.23);
          transform: translateX(calc(var(--size) * .78));
        }
        .cymon-cb-wrapper input[type="checkbox"]:checked + .cymon-cb-label {
          background-color: #6b21a8;
          background-image: linear-gradient(43deg, #6b21a8 0%, #9333ea 46%, #c084fc 100%);
          box-shadow: rgba(0, 0, 0, 0.2) 0px 6px 12px, rgba(0, 0, 0, 0.1) 0px 2px 4px;
        }
        .cymon-cb-wrapper input[type="checkbox"]:checked + .cymon-cb-label:before {
          width: 0;
          height: 0;
        }

        /* Dark Mode Overrides */
        .dark .cymon-cb-label {
          box-shadow: 0 var(--shadow) #334155;
        }
        .dark .cymon-cb-label:before {
          background-color: #0f172a;
          box-shadow: inset 0 var(--shadow) #334155;
        }
        .dark .cymon-cb-label:hover:before {
          box-shadow: inset 0 var(--shadow) #475569;
        }
        .cymon-cb-wrapper input[type="checkbox"]:checked + .cymon-cb-label .cymon-cb-tick:before,
        .cymon-cb-wrapper input[type="checkbox"]:checked + .cymon-cb-label .cymon-cb-tick:after {
          transform: translate(0);
          opacity: 1;
        }
      `}</style>
      <input id={inputId} type="checkbox" {...rest} />
      <label htmlFor={inputId} className="cymon-cb-label">
        <div className="cymon-cb-tick"></div>
      </label>
      {label && (
        <label htmlFor={inputId} className="text-sm text-slate-700 dark:text-slate-300 font-medium select-none cursor-pointer transition-colors">
          {label}
        </label>
      )}
    </div>
  )
}

export default Checkbox
