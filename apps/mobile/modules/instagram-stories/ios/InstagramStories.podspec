Pod::Spec.new do |s|
  s.name           = 'InstagramStories'
  s.version        = '1.0.0'
  s.summary        = 'Opens Instagram Stories with a picture from Quotd'
  s.description    = 'Opens Instagram Stories with a picture from Quotd'
  s.author         = ''
  s.homepage       = 'https://quotd.today'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
