import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './i18n'
import App from './App'

// iOS Safari: 禁用默认的双指缩放整个网页行为，但保留事件传递供组件内部使用(如查看器和模型)
document.addEventListener('touchmove', function(event) {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
}, { passive: false });

// 禁止手势缩放(safari)
document.addEventListener('gesturestart', function(event) {
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
