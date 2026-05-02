import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { moderateScale } from '../utils/responsive';
import { supabase } from '../lib/supabase';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: number;
};

type GeminiContent = {
  role: 'user' | 'assistant';
  parts: { text: string }[];
};

const SYSTEM_PROMPT = [
  'You are the Fixit Partner AI support assistant for service providers using the OPUS/FIXIT provider app.',
  'Help with payouts, active jobs, bookings, KYC verification, profile setup, technical issues, app navigation, and ticket guidance.',
  'Be concise, calm, and practical. Ask one focused question when more details are needed.',
  'Never claim you have changed account data, payment data, KYC status, or booking status. Instead, explain the next step or suggest raising a support ticket.',
  'For urgent safety, payment fraud, or account lock issues, tell the provider to call support or raise a ticket from the Support screen.',
].join('\n');

const QUICK_REPLIES = [
  'My payout is delayed',
  'I cannot accept a job',
  'KYC is pending',
  'App login issue',
  'Customer address problem',
];

const initialMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hi, I am Fixit AI Support. Tell me what is happening and I will help you with the next step.',
  createdAt: Date.now(),
};

const GeminiChatSupportScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [messages, isSending]);

  const buildGeminiContents = (nextMessages: ChatMessage[]): GeminiContent[] =>
    nextMessages
      .filter((message) => message.id !== 'welcome')
      .slice(-12)
      .map((message) => ({
        role: message.role,
        parts: [{ text: message.text }],
      }));

  const createMessage = (role: ChatRole, text: string): ChatMessage => ({
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt: Date.now(),
  });

  const sendMessage = async (textFromChip?: string) => {
    const trimmedText = (textFromChip ?? input).trim();
    if (!trimmedText || isSending) return;

    const userMessage = createMessage('user', trimmedText);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('provider-ai-support', {
        body: {
          messages: buildGeminiContents(nextMessages),
          systemPrompt: SYSTEM_PROMPT,
        },
      });

      if (error) {
        throw error;
      }

      const replyText = typeof data?.reply === 'string' ? data.reply.trim() : '';
      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          replyText || 'I could not read a response from Gemini. Please try again or raise a support ticket.'
        ),
      ]);
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          'AI support is not available right now. Please try again, or raise a ticket so the support team can follow up.'
        ),
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
        {!isUser ? (
          <View style={styles.botAvatar}>
            <Ionicons name="sparkles" size={moderateScale(15)} color="#ffffff" />
          </View>
        ) : null}
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <Text style={[styles.messageText, { color: isUser ? '#ffffff' : colors.text }]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#004c8f" />
      <LinearGradient
        colors={['#004c8f', '#0c1a5d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, moderateScale(10)) }]}
      >
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={moderateScale(22)} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>AI Support</Text>
          <Text style={styles.headerSubtitle}>Gemini assistant for Fixit partners</Text>
        </View>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => (navigation as any).navigate('RaiseTicket')}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={moderateScale(20)} color="#ffffff" />
        </TouchableOpacity>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? moderateScale(8) : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isSending ? (
              <View style={styles.typingRow}>
                <View style={styles.botAvatar}>
                  <Ionicons name="sparkles" size={moderateScale(15)} color="#ffffff" />
                </View>
                <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.typingText, { color: colors.textSecondary }]}>Gemini is typing...</Text>
                </View>
              </View>
            ) : null
          }
        />

        <View style={styles.quickReplyWrap}>
          <FlatList
            horizontal
            data={QUICK_REPLIES}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickReplyContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.quickChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => sendMessage(item)}
                activeOpacity={0.85}
                disabled={isSending}
              >
                <Text style={[styles.quickChipText, { color: colors.text }]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={input}
            onChangeText={setInput}
            placeholder="Type your issue..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1200}
            editable={!isSending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() && !isSending ? colors.primary : colors.border }]}
            onPress={() => sendMessage()}
            activeOpacity={0.85}
            disabled={!input.trim() || isSending}
          >
            <Ionicons name="send" size={moderateScale(18)} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingBottom: moderateScale(16),
  },
  headerIconBtn: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: moderateScale(12),
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: moderateScale(20),
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#dbeafe',
    fontSize: moderateScale(12),
    marginTop: moderateScale(2),
  },
  keyboardView: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(18),
    paddingBottom: moderateScale(16),
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: moderateScale(12),
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: moderateScale(15),
    backgroundColor: '#004c8f',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(8),
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: moderateScale(16),
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(10),
  },
  messageText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(10),
  },
  typingBubble: {
    borderWidth: 1,
    borderRadius: moderateScale(16),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(9),
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    marginLeft: moderateScale(8),
    fontSize: moderateScale(13),
  },
  quickReplyWrap: {
    minHeight: moderateScale(46),
  },
  quickReplyContent: {
    paddingHorizontal: moderateScale(12),
    paddingBottom: moderateScale(8),
  },
  quickChip: {
    borderWidth: 1,
    borderRadius: moderateScale(18),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    marginHorizontal: moderateScale(4),
  },
  quickChipText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  inputBar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: moderateScale(12),
    paddingTop: moderateScale(10),
    paddingBottom: Platform.OS === 'ios' ? moderateScale(18) : moderateScale(12),
  },
  input: {
    flex: 1,
    minHeight: moderateScale(44),
    maxHeight: moderateScale(110),
    borderWidth: 1,
    borderRadius: moderateScale(18),
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(10),
    fontSize: moderateScale(14),
  },
  sendBtn: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: moderateScale(8),
  },
});

export default GeminiChatSupportScreen;
