plugins {
    // Keep root project lean; modules apply what they need.
}

allprojects {
    group = "com.neuvo.alice"
    version = "0.1.0-SNAPSHOT"

    repositories {
        mavenCentral()
    }
}

subprojects {
    plugins.apply("java-library")

    java {
        toolchain {
            languageVersion.set(JavaLanguageVersion.of(17))
        }
    }
}

