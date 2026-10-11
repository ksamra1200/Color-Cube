// Android has navigator.vibrate. iPhone Safari doesn't, but toggling a native
// <input switch> (iOS 18+) plays the system tap haptic, so we flip a hidden one.
export class Haptics {
  constructor() {
    this.enabled = true;
    this.label = null;
  }

  tap(strength = 'light') {
    if (!this.enabled) return;
    try {
      if (navigator.vibrate) {
        navigator.vibrate(strength === 'heavy' ? 35 : strength === 'medium' ? 20 : 10);
        return;
      }
      if (!this.label) {
        this.label = document.createElement('label');
        this.label.setAttribute('aria-hidden', 'true');
        this.label.style.cssText =
          'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.tabIndex = -1;
        this.label.append(input);
        document.body.append(this.label);
      }
      this.label.click();
    } catch {
      // Haptics are a nicety; ignore anything the browser refuses.
    }
  }
}
