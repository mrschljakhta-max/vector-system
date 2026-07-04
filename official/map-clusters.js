(() => {
  window.vectorClusters = {
    enabled: false,
    toggle(){ this.enabled = !this.enabled; console.log('clusters', this.enabled); }
  };
})();