import { Mixpanel } from 'mixpanel-react-native';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface AnalyticsEvent {
  event_type: 'page_view' | 'page_exit' | 'service_view' | 'service_select' | 'button_click' | 'search' | 'purchase' | 'cart_add' | 'cart_remove' | 'custom';
  page_name?: string;
  page_path?: string;
  service_type?: string;
  service_id?: string;
  user_id?: string;
  session_id: string;
  timestamp: string;
  duration_ms?: number; // Time spent on page
  metadata?: Record<string, any>; // Additional data
  device_info?: {
    platform?: string;
    os_version?: string;
    app_version?: string;
  };
}

class AnalyticsService {
  private sessionId: string;
  private pageStartTimes: Map<string, number> = new Map();
  private mixpanel: Mixpanel | null = null;
  private mixpanelInitialized: boolean = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeMixpanel();
  }

  /**
   * Initialize Mixpanel
   */
  private initializeMixpanel() {
    try {
      if (Platform.OS === 'web') {
        console.warn('Mixpanel not supported on web; disabling analytics.');
        return;
      }

      const mixpanelToken = Constants.expoConfig?.extra?.EXPO_PUBLIC_MIXPANEL_TOKEN || 
                           process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
      
      if (!mixpanelToken) {
        console.warn('Mixpanel token not found. Analytics tracking will be disabled.');
        return;
      }

      // Initialize Mixpanel
      if (typeof (Mixpanel as unknown as any) !== 'function') {
        console.warn('Mixpanel native module unavailable; analytics disabled. Use a Dev Client or prebuild.');
        return;
      }

      this.mixpanel = new Mixpanel(mixpanelToken, false); // false = don't track automatic events
      // mixpanel-react-native init returns Promise; await to catch failures
      // If caller doesn't await constructor, it may still resolve later, but we guard here
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.mixpanel.init();
      this.mixpanelInitialized = true;
      console.log('Mixpanel initialized successfully');
    } catch (error) {
      console.error('Mixpanel initialization error:', error);
      this.mixpanel = null;
      this.mixpanelInitialized = false;
    }
  }

  /**
   * Identify user in Mixpanel
   */
  identifyUser(userId: string, userProperties?: Record<string, any>) {
    if (this.mixpanel && this.mixpanelInitialized) {
      try {
        this.mixpanel.identify(userId);
        if (userProperties) {
          this.mixpanel.getPeople().set(userProperties);
        }
      } catch (error) {
        console.error('Mixpanel identify error:', error);
      }
    }
  }

  /**
   * Reset Mixpanel user (on logout)
   */
  resetUser() {
    if (this.mixpanel && this.mixpanelInitialized) {
      try {
        this.mixpanel.reset();
      } catch (error) {
        console.error('Mixpanel reset error:', error);
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceInfo() {
    // You can enhance this with actual device info using expo-device
    return {
      platform: 'mobile',
      app_version: '1.0.0',
    };
  }

  /**
   * Track a page view
   */
  async trackPageView(pageName: string, pagePath: string, userId?: string) {
    const startTime = Date.now();
    this.pageStartTimes.set(pagePath, startTime);

    const event: AnalyticsEvent = {
      event_type: 'page_view',
      page_name: pageName,
      page_path: pagePath,
      user_id: userId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      device_info: this.getDeviceInfo(),
    };

    await this.queueEvent(event);
  }

  /**
   * Track page exit and calculate time spent
   */
  async trackPageExit(pageName: string, pagePath: string, userId?: string) {
    const startTime = this.pageStartTimes.get(pagePath);
    const duration = startTime ? Date.now() - startTime : undefined;
    
    if (startTime) {
      this.pageStartTimes.delete(pagePath);
    }

    const event: AnalyticsEvent = {
      event_type: 'page_exit',
      page_name: pageName,
      page_path: pagePath,
      user_id: userId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      device_info: this.getDeviceInfo(),
    };

    await this.queueEvent(event);
  }

  /**
   * Track service view
   */
  async trackServiceView(serviceType: string, serviceId?: string, userId?: string, metadata?: Record<string, any>) {
    const event: AnalyticsEvent = {
      event_type: 'service_view',
      service_type: serviceType,
      service_id: serviceId,
      user_id: userId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata,
      device_info: this.getDeviceInfo(),
    };

    await this.queueEvent(event);
  }

  /**
   * Track service selection/preference
   */
  async trackServiceSelect(serviceType: string, serviceId?: string, userId?: string, metadata?: Record<string, any>) {
    const event: AnalyticsEvent = {
      event_type: 'service_select',
      service_type: serviceType,
      service_id: serviceId,
      user_id: userId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata,
      device_info: this.getDeviceInfo(),
    };

    await this.queueEvent(event);
  }

  /**
   * Track button clicks or interactions
   */
  async trackInteraction(
    interactionType: string,
    pageName?: string,
    elementId?: string,
    userId?: string,
    metadata?: Record<string, any>
  ) {
    const event: AnalyticsEvent = {
      event_type: 'button_click',
      page_name: pageName,
      user_id: userId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        interaction_type: interactionType,
        element_id: elementId,
        ...metadata,
      },
      device_info: this.getDeviceInfo(),
    };

    await this.queueEvent(event);
  }

  /**
   * Track search events
   */
  async trackSearch(query: string, resultsCount?: number, userId?: string, metadata?: Record<string, any>) {
    const event: AnalyticsEvent = {
      event_type: 'search',
      user_id: userId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        query,
        results_count: resultsCount,
        ...metadata,
      },
      device_info: this.getDeviceInfo(),
    };

    await this.queueEvent(event);
  }

  /**
   * Track cart operations
   */
  async trackCartAdd(itemId: string, itemName: string, price?: number, userId?: string) {
    const event: AnalyticsEvent = {
      event_type: 'cart_add',
      user_id: userId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        item_id: itemId,
        item_name: itemName,
        price,
      },
      device_info: this.getDeviceInfo(),
    };

    await this.queueEvent(event);
  }

  async trackCartRemove(itemId: string, userId?: string) {
    const event: AnalyticsEvent = {
      event_type: 'cart_remove',
      user_id: userId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        item_id: itemId,
      },
      device_info: this.getDeviceInfo(),
    };

    await this.queueEvent(event);
  }

  /**
   * Track custom events
   */
  async trackCustomEvent(
    eventName: string,
    userId?: string,
    metadata?: Record<string, any>
  ) {
    const event: AnalyticsEvent = {
      event_type: 'custom',
      user_id: userId,
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        custom_event_name: eventName,
        ...metadata,
      },
      device_info: this.getDeviceInfo(),
    };

    await this.queueEvent(event);
  }

  /**
   * Queue event - send directly to Mixpanel
   */
  private async queueEvent(event: AnalyticsEvent) {
    // Send to Mixpanel immediately (Mixpanel handles batching internally)
    this.sendToMixpanel(event);
  }

  /**
   * Send event to Mixpanel
   */
  private sendToMixpanel(event: AnalyticsEvent) {
    if (!this.mixpanel || !this.mixpanelInitialized) {
      return;
    }

    try {
      // Map event type to Mixpanel event name
      const mixpanelEventName = this.getMixpanelEventName(event.event_type);
      
      // Prepare Mixpanel properties
      const properties: Record<string, any> = {
        session_id: event.session_id,
        timestamp: event.timestamp,
        ...event.device_info,
      };

      // Add event-specific properties
      if (event.page_name) properties.page_name = event.page_name;
      if (event.page_path) properties.page_path = event.page_path;
      if (event.service_type) properties.service_type = event.service_type;
      if (event.service_id) properties.service_id = event.service_id;
      if (event.duration_ms) properties.duration_ms = event.duration_ms;
      if (event.metadata) {
        // Flatten metadata into properties
        Object.assign(properties, event.metadata);
      }

      // Track event in Mixpanel
      this.mixpanel.track(mixpanelEventName, properties);

      // Set user properties if user_id exists
      if (event.user_id) {
        this.mixpanel.getPeople().set({
          last_seen: new Date().toISOString(),
          user_id: event.user_id,
        });
      }
    } catch (error) {
      console.error('Mixpanel track error:', error);
    }
  }

  /**
   * Map internal event types to Mixpanel event names
   */
  private getMixpanelEventName(eventType: string): string {
    const eventMap: Record<string, string> = {
      'page_view': 'Page Viewed',
      'page_exit': 'Page Exited',
      'service_view': 'Service Viewed',
      'service_select': 'Service Selected',
      'button_click': 'Button Clicked',
      'search': 'Search Performed',
      'purchase': 'Purchase Completed',
      'cart_add': 'Added to Cart',
      'cart_remove': 'Removed from Cart',
      'custom': 'Custom Event',
    };

    return eventMap[eventType] || eventType;
  }

  /**
   * Force flush all pending events (Mixpanel handles this internally)
   */
  async flush() {
    // Mixpanel handles batching and flushing internally
    // This method is kept for API compatibility but does nothing
    if (this.mixpanel && this.mixpanelInitialized) {
      // Mixpanel automatically flushes events, but we can force it if needed
      // Note: mixpanel-react-native doesn't expose a flush method, it handles it automatically
    }
  }

  /**
   * Start a new session
   */
  startNewSession() {
    this.sessionId = this.generateSessionId();
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

