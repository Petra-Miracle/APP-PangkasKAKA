const { withMainApplication } = require("@expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

// VisionCamera's Nitro-generated PreviewView.previewOutput HostFunction requires
// the `useRawPropsJsiValue` React Native feature flag, which defaults to false
// and has no JS-level toggle. See: react-native-vision-camera crash
// "Cannot cast dynamic to a jsi::Value type. Please use the 'useRawPropsJsiValue'
// feature flag..." — must be overridden natively before React Native starts.
module.exports = function withRawPropsJsiValueFlag(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    const isKotlin = config.modResults.language === "kt";

    contents = mergeContents({
      src: contents,
      newSrc: isKotlin
        ? "import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags\nimport com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults"
        : "import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags;\nimport com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults;",
      tag: "raw-props-jsi-value-import",
      anchor: /^import /m,
      offset: 0,
      comment: "//",
    }).contents;

    // loadReactNative(this) -> DefaultNewArchitectureEntryPoint.load() already calls
    // ReactNativeFeatureFlags.override() once (for Fabric/TurboModules/Bridgeless), and RN
    // throws "Feature flags cannot be overridden more than once" on a second plain override()
    // call. dangerouslyForceOverride() is RN's supported way to override again after that,
    // so we also replicate the New Architecture defaults here (not just useRawPropsJsiValue)
    // to avoid regressing Fabric/TurboModules/Bridgeless back to legacy defaults.
    contents = mergeContents({
      src: contents,
      newSrc: isKotlin
        ? "    ReactNativeFeatureFlags.dangerouslyForceOverride(object : ReactNativeNewArchitectureFeatureFlagsDefaults(true) {\n      override fun useFabricInterop(): Boolean = true\n      override fun enableFabricRenderer(): Boolean = true\n      override fun useTurboModules(): Boolean = true\n      override fun useShadowNodeStateOnClone(): Boolean = true\n      override fun useRawPropsJsiValue(): Boolean = true\n    })"
        : "    ReactNativeFeatureFlags.dangerouslyForceOverride(new ReactNativeNewArchitectureFeatureFlagsDefaults(true) {\n      @Override public boolean useFabricInterop() { return true; }\n      @Override public boolean enableFabricRenderer() { return true; }\n      @Override public boolean useTurboModules() { return true; }\n      @Override public boolean useShadowNodeStateOnClone() { return true; }\n      @Override public boolean useRawPropsJsiValue() { return true; }\n    });",
      tag: "raw-props-jsi-value-override",
      // Must run AFTER loadReactNative(this) — that's what calls SoLoader.init() AND
      // performs RN's own first override() call that we need to override again.
      anchor: /loadReactNative\(this\)/,
      offset: 1,
      comment: "//",
    }).contents;

    config.modResults.contents = contents;
    return config;
  });
};
